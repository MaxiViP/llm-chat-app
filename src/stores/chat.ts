import { defineStore } from 'pinia'
import { ref, onMounted, watch } from 'vue'
import { sendMessageStream, setProvider, type Message, getAvailableModels } from '@/services/llm'

interface ModelOption {
  value: string
  label: string
}

type ProviderKey = 'groq' | 'openrouter'

export const useChatStore = defineStore('chat', () => {
  const LOCAL_STORAGE_KEY = 'chat_messages'

  const messages = ref<Message[]>([
    {
      role: 'system',
      content: 'Ты полезный ассистент. Отвечай кратко и по делу на русском языке.',
    },
  ])

  const isLoading = ref(false)
  const isModelsLoading = ref(true)
  const selectedModel = ref<string>('smart')
  const error = ref<string | null>(null)
  const availableModels = ref<ModelOption[]>([])
  const provider = ref<ProviderKey>('groq')

  /* -------------------------------------------------------------------------- */
  /*  ЗАГРУЗКА И СОХРАНЕНИЕ В LOCALSTORAGE                                      */
  /* -------------------------------------------------------------------------- */

  // загружаем сообщения при старте
  onMounted(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (saved) {
      try {
        messages.value = JSON.parse(saved)
      } catch {}
    }
    loadAvailableModels()
    setProvider(provider.value)
  })

  // сохраняем при изменении сообщений
  watch(
    messages,
    (val) => {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(val))
    },
    { deep: true },
  )

  /* -------------------------------------------------------------------------- */
  /*  МОДЕЛИ                                                                      */
  /* -------------------------------------------------------------------------- */

  async function loadAvailableModels() {
    isModelsLoading.value = true

    // alias модели
    availableModels.value = [
      { value: 'fast', label: '⚡ Быстрая (дёшево)' },
      { value: 'smart', label: '🧠 Умная (баланс)' },
      { value: 'code', label: '💻 Для кода' },
      { value: 'manual', label: '🛠 Ручная (своя модель)' },
    ]

    // можно добавить реальные модели провайдера
    const realModels = await getAvailableModels(provider.value)
    if (realModels.length) {
      availableModels.value.push(...realModels)
    }

    if (!selectedModel.value) selectedModel.value = 'smart'
    isModelsLoading.value = false
  }

  async function changeProvider(newProvider: ProviderKey) {
    if (provider.value === newProvider) return
    provider.value = newProvider
    setProvider(newProvider)
    await loadAvailableModels()
  }

  /* -------------------------------------------------------------------------- */
  /*  CHAT ЛОГИКА                                                                */
  /* -------------------------------------------------------------------------- */

  function addUserMessage(content: string) {
    messages.value.push({ role: 'user', content })
  }

  function addAssistantMessage(content: string) {
    messages.value.push({ role: 'assistant', content })
  }

  function updateLastMessage(content: string) {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant') {
      last.content = content
    }
  }

  async function sendMessage(userInput: string) {
    if (!userInput.trim() || isLoading.value || !selectedModel.value) return

    addUserMessage(userInput)
    addAssistantMessage('') // placeholder

    isLoading.value = true
    error.value = null
    let accumulated = ''

    try {
      const historyForAPI = messages.value.filter((m) => m.role !== 'system')
      await sendMessageStream(historyForAPI, selectedModel.value, (chunk) => {
        accumulated += chunk
        updateLastMessage(accumulated)
      })
    } catch (err: any) {
      error.value = err.message || 'Ошибка генерации ответа'
      updateLastMessage(
        accumulated + '\n\n(ответ прерван: ' + (err.message || 'неизвестная ошибка') + ')',
      )
    } finally {
      setTimeout(() => (isLoading.value = false), 300)
    }
  }

  /* -------------------------------------------------------------------------- */
  /*  ОЧИСТКА ЧАТА                                                              */
  /* -------------------------------------------------------------------------- */

  function clearChat() {
    messages.value = [
      {
        role: 'system',
        content: 'Ты полезный ассистент. Отвечай кратко и по делу на русском языке.',
      },
    ]
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  }

  return {
    messages,
    isLoading,
    isModelsLoading,
    selectedModel,
    error,
    availableModels,
    provider,

    sendMessage,
    clearChat,
    changeProvider,
    updateLastMessage,
    loadAvailableModels,
  }
})
