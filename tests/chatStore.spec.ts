// tests/chatStore.spec.ts
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '@/stores/chat'

// -----------------------------------------------------------------------------
// Моки сервисов из `llm.ts`
// -----------------------------------------------------------------------------
jest.mock('@/services/llm', () => {
  // Импортируем типы, чтобы их можно было использовать в тестах
  const real = jest.requireActual<any>('../src/services/llm')
  return {
    ...real,
    setProvider: jest.fn(),
    getAvailableModels: jest.fn(async (provider: string) => {
      if (provider === 'groq') {
        return [
          { value: 'gpt-4', label: 'Groq GPT‑4' },
          { value: 'llama-3.1-8b-instant', label: 'Groq Llama 8B' },
        ]
      }
      if (provider === 'openrouter') {
        return [
          { value: 'gemini-pro', label: 'OpenRouter Gemini' },
          { value: 'mistral-nemo', label: 'OpenRouter Mistral' },
        ]
      }
      return []
    }),
    sendMessageStream: jest.fn(async (_messages, _model, onChunk) => {
      // Простая имитация потокового ответа
      for (const chunk of ['Привет', ' ', 'мир']) {
        await new Promise((r) => setTimeout(r, 5))
        onChunk(chunk)
      }
    }),
  }
})

describe('chat store', () => {
  beforeEach(() => {
    // Создаём новую Pinia‑инстанцию для каждого теста
    setActivePinia(createPinia())
  })

  /* --------------------------------------------------------------------- */
  /*   trimHistory – обрезка по токенам                                   */
  /* --------------------------------------------------------------------- */
  it('trimHistory обрезает историю и добавляет предупреждение', () => {
    const store = useChatStore()

    // 1 системное + 2 пользовательские сообщения
    const msgs = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'x'.repeat(2000) }, // 2000 символов
      { role: 'assistant', content: 'y'.repeat(2000) }, // 2000 символов
    ]

    const trimmed = store.trimHistory(msgs, 500) // ~2000 символов

    expect(trimmed.length).toBeGreaterThan(1)
    expect(trimmed.some((m) => m.content.includes('обрезана'))).toBeTruthy()
  })

  /* --------------------------------------------------------------------- */
  /*   isResponseValid – проверка валидности ответа                        */
  /* --------------------------------------------------------------------- */
  it('isResponseValid отбрасывает короткие и «некорректные» ответы', () => {
    const store = useChatStore()

    expect(store.isResponseValid('...')).toBe(false)
    expect(store.isResponseValid('Привет, мир!')).toBe(true)
    expect(store.isResponseValid('😊')).toBe(false)
  })

  /* --------------------------------------------------------------------- */
  /*   getFallbackModels – список резервных моделей                       */
  /* --------------------------------------------------------------------- */
  it('getFallbackModels возвращает резервный список при пустом кеше', async () => {
    const store = useChatStore()

    // Очистим кеш
    store.cachedRealModels.groq = []
    store.cachedRealModels.openrouter = []

    const list = store.getFallbackModels()
    expect(list).toHaveLength(3)
    expect(list[0].provider).toBe('groq')
  })

  /* --------------------------------------------------------------------- */
  /*   tryGetResponseWithFallback – попытка через все модели              */
  /* --------------------------------------------------------------------- */
  it('tryGetResponseWithFallback возвращает true при валидном ответе', async () => {
    const store = useChatStore()
    const history: Message[] = [{ role: 'user', content: 'Привет' }]

    const success = await store.tryGetResponseWithFallback(history, jest.fn())
    expect(success).toBe(true)
  })

  /* --------------------------------------------------------------------- */
  /*   sendMessage – полный поток от пользователя к ассистенту            */
  /* --------------------------------------------------------------------- */
  it('sendMessage добавляет пользовательское сообщение и заполняет ассистента', async () => {
    const store = useChatStore()

    await store.sendMessage('Привет')

    // Последнее сообщение должно быть ассистентом
    const lastMsg = store.messages[store.messages.length - 1]
    expect(lastMsg.role).toBe('assistant')
    // Из мок‑ответа: "Привет мир"
    expect(lastMsg.content).toContain('мир')
  })

  /* --------------------------------------------------------------------- */
  /*   clearChat – очищает историю и localStorage                         */
  /* --------------------------------------------------------------------- */
  it('clearChat обнуляет сообщения и удаляет ключ из localStorage', () => {
    const store = useChatStore()

    // Сохраняем тестовое сообщение
    store.addUserMessage('test')
    expect(store.messages.length).toBe(2)

    // Очищаем
    store.clearChat()
    expect(store.messages.length).toBe(1)
    expect(localStorage.getItem('chat_messages')).toBeNull()
  })
})
