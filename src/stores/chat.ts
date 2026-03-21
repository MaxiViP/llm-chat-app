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
  const isModelsLoading = ref(true) // новый флаг — пока модели не загрузились
  const selectedModel = ref<string>('')
  const error = ref<string | null>(null)
  const availableModels = ref<ModelOption[]>([])
  const modelsLoaded = ref(false) // чтобы не грузить повторно

  // Загрузка списка моделей
  async function loadAvailableModels(force = false) {
    if (modelsLoaded.value && !force) return // уже загружено — не повторяем

    isModelsLoading.value = true
    error.value = null

    try {
      const res = await fetch('/api/groq/models', {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      const modelIds: string[] = data.data?.map((m: any) => m.id) || []

      console.log(`Получено моделей от Groq: ${modelIds.length}`)
      console.log('Список моделей:', modelIds)

      if (modelIds.length === 0) {
        throw new Error('API вернул пустой список моделей')
      }

      // Формируем красивые метки
      availableModels.value = modelIds.map((id: string) => {
        let cleanName = id.replace(/^[^/]+\//, '')
        let label = cleanName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

        if (id.includes('70b')) label += ' — 70B (мощная)'
        else if (id.includes('8b') || id.includes('9b')) label += ' — 8–9B (быстрая)'
        else if (id.includes('120b')) label += ' — 120B (очень мощная)'
        else if (id.includes('scout')) label += ' — Scout (новая)'
        else label += ' — Groq'

        return { value: id, label }
      })

      // Сортировка по размеру (примерно)
      availableModels.value.sort((a, b) => {
        const getSize = (s: string) => {
          if (s.includes('120b')) return 120
          if (s.includes('70b')) return 70
          if (s.includes('32b') || s.includes('scout')) return 32
          if (s.includes('8b') || s.includes('9b')) return 9
          return 0
        }
        return getSize(b.value) - getSize(a.value)
      })

      modelsLoaded.value = true
      console.log('Список моделей готов для UI:', availableModels.value)
    } catch (err: any) {
      console.error('Ошибка загрузки моделей:', err)
      error.value = 'Не удалось загрузить список моделей. Проверьте ключ API и интернет.'

      // Минимальный fallback — хотя бы одна рабочая модель
      availableModels.value = [
        { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (резервная)' },
      ]
    } finally {
      isModelsLoading.value = false

      // Автовыбор первой модели, если ещё не выбрана
      if (!selectedModel.value && availableModels.value.length > 0) {
        selectedModel.value = availableModels.value[0].value
      }
    }
  }

  // Инициализация
  onMounted(() => {
    loadAvailableModels()
  })

  // ────────────────────────────────────────────────
  // Функции чата
  // ────────────────────────────────────────────────

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

      console.log('Стрим успешно завершён')
    } catch (err: any) {
      console.error('Ошибка при генерации ответа:', err)
      error.value = err.message || 'Ошибка генерации ответа. Попробуйте снова.'
      updateLastMessage(
        accumulated + '\n\n(ответ прерван: ' + (err.message || 'неизвестная ошибка') + ')',
      )
    } finally {
      // Небольшая задержка — чтобы Vue успел отрендерить последний чанк
      setTimeout(() => {
        isLoading.value = false
        console.log('isLoading сброшен')
      }, 300)
    }
  }

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
    isModelsLoading, // можно использовать в UI для показа лоадера при выборе модели
    selectedModel,
    error,
    availableModels,
    sendMessage,
    clearChat,
    updateLastMessage,
    loadAvailableModels, // для кнопки "Обновить список моделей"
  }
})
