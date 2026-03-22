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
  const currentFallbackAttempt = ref(0)
  const isLastMessageStreaming = ref(false)

  const cachedRealModels = ref<Record<ProviderKey, ModelOption[]>>({
    groq: [],
    openrouter: [],
  })

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

  watch(
    messages,
    (val) => {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(val))
    },
    { deep: true },
  )

  async function loadAvailableModels() {
    isModelsLoading.value = true

    availableModels.value = [
      { value: 'fast', label: '⚡ Быстрая' },
      { value: 'smart', label: '🧠 Умная' },
      { value: 'code', label: '💻 Код' },
      { value: 'manual', label: '🛠 Своя модель' },
    ]

    for (const p of ['groq', 'openrouter'] as ProviderKey[]) {
      try {
        const realModels = await getAvailableModels(p)
        if (realModels.length) {
          cachedRealModels.value[p] = realModels
          const existingIds = new Set(availableModels.value.map((m) => m.value))
          for (const model of realModels) {
            if (!existingIds.has(model.value)) {
              availableModels.value.push(model)
            }
          }
        }
      } catch (e) {
        console.warn(`Не удалось загрузить модели для ${p}`, e)
      }
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

  function addUserMessage(content: string) {
    messages.value.push({ role: 'user', content })
  }

  function createAssistantMessage() {
    const msg = { role: 'assistant', content: '' } as Message
    messages.value.push(msg)
    return msg
  }

  function isResponseValid(content: string): boolean {
    if (!content || content.trim().length === 0) return false
    if (content.trim().length < 10) return false

    const trimmed = content.trim().toLowerCase()
    const emptyResponses = [
      '...',
      '😊',
      '👍',
      '👌',
      '✅',
      '❌',
      '🙂',
      ':)',
      ':(',
      ';)',
      'да',
      'нет',
      'ок',
      'ok',
      'хорошо',
      'плохо',
      'норм',
    ]

    if (emptyResponses.includes(trimmed)) return false
    return true
  }

  function getFallbackModels(): Array<{ provider: ProviderKey; model: string; name: string }> {
    const fallbackList: Array<{ provider: ProviderKey; model: string; name: string }> = []

    for (const model of cachedRealModels.value.groq) {
      fallbackList.push({
        provider: 'groq',
        model: model.value,
        name: `Groq: ${model.label}`,
      })
    }

    for (const model of cachedRealModels.value.openrouter) {
      fallbackList.push({
        provider: 'openrouter',
        model: model.value,
        name: `OpenRouter: ${model.label}`,
      })
    }

    if (fallbackList.length === 0) {
      return [
        { provider: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq Llama 70B (резерв)' },
        { provider: 'groq', model: 'llama-3.1-8b-instant', name: 'Groq Llama 8B (резерв)' },
        {
          provider: 'openrouter',
          model: 'google/gemini-2.0-flash-exp:free',
          name: 'OpenRouter Gemini (резерв)',
        },
      ]
    }

    return fallbackList
  }

  function trimHistory(messages: Message[], maxTokens: number = 2500): Message[] {
    const systemMessages = messages.filter((m) => m.role === 'system')
    const otherMessages = messages.filter((m) => m.role !== 'system')

    let totalChars = 0
    const trimmedMessages: Message[] = [...systemMessages]

    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msg = otherMessages[i]
      const charCount = msg.content.length
      if (totalChars + charCount <= maxTokens * 4) {
        trimmedMessages.unshift(msg)
        totalChars += charCount
      } else {
        if (i < otherMessages.length - 1) {
          trimmedMessages.unshift({
            role: 'system',
            content: '⚠️ Часть истории была обрезана из-за ограничения по токенам.',
          })
        }
        break
      }
    }

    console.log(
      `📊 История обрезана: было ${otherMessages.length} сообщений (${totalChars} символов), осталось ${trimmedMessages.length - systemMessages.length} сообщений`,
    )
    return trimmedMessages
  }

  async function tryGetResponseWithFallback(
    historyMessages: Message[],
    onChunk: (chunk: string) => void,
  ): Promise<boolean> {
    const fallbackModels = getFallbackModels()
    let lastError: any = null

    console.log(`📋 Всего моделей для fallback: ${fallbackModels.length}`)

    for (let i = 0; i < fallbackModels.length; i++) {
      const item = fallbackModels[i]
      currentFallbackAttempt.value = i + 1

      try {
        console.log(`🚀 Попытка ${i + 1}/${fallbackModels.length}: ${item.name}`)

        setProvider(item.provider)

        let response = ''

        await sendMessageStream(historyMessages, item.model, (chunk) => {
          response += chunk
          onChunk(chunk)
        })

        if (isResponseValid(response)) {
          console.log(`✅ Успешный ответ от ${item.name}, длина: ${response.length} символов`)
          return true
        } else {
          console.warn(`⚠️ Ответ от ${item.name} слишком короткий или пустой, пробуем дальше...`)
          onChunk('')
          lastError = new Error('Пустой или слишком короткий ответ')
        }
      } catch (err: any) {
        const errorMsg = err.message || ''
        if (errorMsg.includes('429') || errorMsg.includes('rate_limit')) {
          console.warn(`⏳ Лимит ${item.name}, пробуем следующую...`)
        } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
          console.warn(`❓ Модель ${item.name} не найдена, пробуем следующую...`)
        } else if (errorMsg.includes('413') || errorMsg.includes('too large')) {
          console.warn(`📦 ${item.name}: запрос слишком большой, пробуем следующую...`)
        } else if (errorMsg.includes('402') || errorMsg.includes('tokens')) {
          console.warn(`💰 ${item.name}: лимит токенов, пробуем следующую...`)
        } else {
          console.warn(`❌ Ошибка при запросе к ${item.name}:`, errorMsg.substring(0, 100))
        }
        lastError = err
        onChunk('')
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    console.error(`❌ Все ${fallbackModels.length} моделей не дали качественного ответа`)
    throw lastError || new Error('Ни одна модель не смогла ответить')
  }

  function getFallbackResponse(userInput: string): string {
    const responses = [
      `Извините, в данный момент сервис временно недоступен. Пожалуйста, попробуйте позже. Ваш запрос: "${userInput.slice(0, 50)}${userInput.length > 50 ? '...' : ''}"`,
      `К сожалению, не удалось обработать ваш запрос. Пожалуйста, попробуйте переформулировать вопрос или подождите немного.`,
      `Технические неполадки. Наши инженеры уже работают над исправлением. Приносим извинения за неудобства.`,
      `Не могу ответить на ваш вопрос прямо сейчас. Пожалуйста, попробуйте позже или задайте другой вопрос.`,
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  async function sendMessage(userInput: string) {
    if (!userInput.trim() || isLoading.value || !selectedModel.value) return

    addUserMessage(userInput)
    const assistantMessage = createAssistantMessage()

    isLoading.value = true
    isLastMessageStreaming.value = true
    error.value = null
    currentFallbackAttempt.value = 0

    try {
      const historyWithoutSystem = messages.value.filter((m) => m.role !== 'system')
      const systemMessage = messages.value.find((m) => m.role === 'system')
      const fullHistory = systemMessage
        ? [systemMessage, ...historyWithoutSystem]
        : historyWithoutSystem

      const trimmedHistory = trimHistory(fullHistory, 2500)

      let fullResponse = ''

      const success = await tryGetResponseWithFallback(trimmedHistory, (chunk) => {
        fullResponse += chunk
        assistantMessage.content = fullResponse
      })

      if (!success) {
        throw new Error('Не удалось получить корректный ответ')
      }

      console.log('✅ Успешно получен ответ от модели')
    } catch (err: any) {
      console.error('❌ Все модели не смогли ответить:', err)
      error.value = err.message || 'Не удалось получить ответ'

      if (err.message?.includes('402') || err.message?.includes('tokens')) {
        assistantMessage.content = `⚠️ **Превышен лимит токенов**\n\nДиалог слишком длинный для бесплатных моделей. Попробуйте:\n• Начать новый чат (кнопка "Очистить чат")\n• Задать более короткий вопрос\n\nВаш вопрос: "${userInput.slice(0, 100)}${userInput.length > 100 ? '...' : ''}"`
      } else if (err.message?.includes('429') || err.message?.includes('rate_limit')) {
        assistantMessage.content = `⏳ **Лимит запросов превышен**\n\nПодождите немного и попробуйте снова.`
      } else {
        assistantMessage.content = getFallbackResponse(userInput)
      }
    } finally {
      isLoading.value = false
      isLastMessageStreaming.value = false
    }
  }

  async function testModel(testProvider: ProviderKey, model: string): Promise<boolean> {
    try {
      setProvider(testProvider)
      let response = ''

      await sendMessageStream([{ role: 'user', content: 'Ответь "тест"' }], model, (chunk) => {
        response += chunk
      })

      return response.trim().length > 0
    } catch {
      return false
    }
  }

  function clearChat() {
    messages.value = [
      {
        role: 'system',
        content: 'Ты полезный ассистент. Отвечай кратко и по делу на русском языке.',
      },
    ]
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    error.value = null
  }

  return {
    messages,
    isLoading,
    isModelsLoading,
    selectedModel,
    error,
    availableModels,
    provider,
    currentFallbackAttempt,
    isLastMessageStreaming,

    sendMessage,
    clearChat,
    changeProvider,
    loadAvailableModels,
    testModel,
  }
})
