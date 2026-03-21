import { defineStore } from 'pinia'
import { ref, onMounted } from 'vue'
import { sendMessageStream, type Message } from '@/services/llm'

interface ModelOption {
  value: string
  label: string
}

export const useChatStore = defineStore('chat', () => {
  // Состояние
  const messages = ref<Message[]>([
    {
      role: 'system',
      content: 'Ты полезный ассистент. Отвечай кратко и по делу на русском языке.',
    },
  ])

  const isLoading = ref(false)
  const selectedModel = ref<string>('')
  const error = ref<string | null>(null)
  const availableModels = ref<ModelOption[]>([
    // Актуальный список на март 2026 (основные рабочие модели Groq)
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile — мощная, универсальная' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant — очень быстрая' },
    { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B — быстрая open-weight' },
    { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B — самая мощная open-weight' },
    {
      value: 'meta-llama/llama-4-scout-17b-16e-instruct',
      label: 'Llama 4 Scout 17B Instruct — новая',
    },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B Instruct — компактная и умная' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B — хороший баланс скорости/качества' },
  ])

  // Загрузка актуального списка моделей при старте
  async function loadAvailableModels() {
    try {
      const res = await fetch('/api/groq/models', {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`)
      }

      const data = await res.json()
      const modelIds = data.data?.map((m: any) => m.id) || []

      if (modelIds.length > 0) {
        availableModels.value = modelIds.map((id: string) => ({
          value: id,
          label:
            id
              .replace(/^.*\//, '') // убираем префиксы типа meta-llama/
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()) + ' — auto',
        }))

        // Сортируем примерно по мощности/популярности (очень грубо)
        availableModels.value.sort((a, b) => {
          if (a.value.includes('120b')) return -1
          if (b.value.includes('120b')) return 1
          if (a.value.includes('70b')) return -1
          if (b.value.includes('70b')) return 1
          return 0
        })

        console.log('Загружены реальные модели с Groq:', availableModels.value)
      }
    } catch (err) {
      console.warn('Не удалось загрузить список моделей с Groq → используем fallback', err)
      // fallback уже задан в ref выше
    } finally {
      // Устанавливаем первую модель по умолчанию, если ещё не выбрана
      if (!selectedModel.value && availableModels.value.length > 0) {
        selectedModel.value = availableModels.value[0].value
      }
    }
  }

  // Инициализация при монтировании стора
  onMounted(() => {
    loadAvailableModels()
  })

  // Добавить сообщение пользователя
  function addUserMessage(content: string) {
    messages.value.push({ role: 'user', content })
  }

  // Добавить ответ ассистента
  function addAssistantMessage(content: string) {
    messages.value.push({ role: 'assistant', content })
  }

  // Обновить последнее сообщение (для стриминга)
  function updateLastMessage(content: string) {
    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage && lastMessage.role === 'assistant') {
      lastMessage.content = content
    }
  }

  // Отправить сообщение
  async function sendMessage(userInput: string) {
    if (!userInput.trim() || isLoading.value || !selectedModel.value) return

    addUserMessage(userInput)
    addAssistantMessage('') // placeholder для стриминга

    isLoading.value = true
    error.value = null

    let accumulated = ''

    try {
      // Фильтруем историю, исключая system prompt (он уже в запросе отдельно)
      const historyForAPI = messages.value.filter((m) => m.role !== 'system')

      await sendMessageStream(historyForAPI, selectedModel.value, (chunk) => {
        accumulated += chunk
        updateLastMessage(accumulated)
      })

      // Успешное завершение — можно добавить маркер или логику
    } catch (err: any) {
      console.error('Ошибка генерации:', err)
      error.value = err.message || 'Ошибка во время генерации ответа'
      updateLastMessage(
        accumulated + '\n\n(ответ прерван: ' + (err.message || 'неизвестная ошибка') + ')',
      )
    } finally {
      isLoading.value = false
    }
  }

  // Очистить историю чата
  function clearChat() {
    messages.value = [
      {
        role: 'system',
        content: 'Ты полезный ассистент. Отвечай кратко и по делу на русском языке.',
      },
    ]
  }

  return {
    messages,
    isLoading,
    selectedModel,
    error,
    availableModels, // ← теперь экспортируем, чтобы компонент мог использовать
    sendMessage,
    clearChat,
    updateLastMessage,
  }
})
