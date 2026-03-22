import axios from 'axios'

/* -------------------------------------------------------------------------- */
/*  Константы и типы                                                          */
/* -------------------------------------------------------------------------- */
export const API_BASE_URL = 'https://api.groq.com/openai/v1' // Groq API (стриминг работает)

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** Описание модели для UI‑селекта */
export interface ModelOption {
  value: string
  label: string
}

/** Доступные модели */
export const availableModels: ModelOption[] = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile — мощная' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant — очень быстрая' },
  { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile — классика' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B Instruct — компактная' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B — хороший баланс' },
  { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B — сильная в коде' },
]

/* -------------------------------------------------------------------------- */
/*  Вспомогательные типы ответа от API                                        */
/* -------------------------------------------------------------------------- */
interface GroqModel {
  id: string
  object: string
  owned_by: string
  // …другие поля, которые могут быть нужны
}

interface GroqModelListResponse {
  data: GroqModel[]
  object: string
}

interface GroqChatChoice {
  index: number
  message?: { role: string; content: string }
  delta?: { role?: string; content?: string }
  finish_reason?: string | null
}

interface GroqChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: GroqChatChoice[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

/* -------------------------------------------------------------------------- */
/*  Получение API‑ключа (Vite)                                                */
/* -------------------------------------------------------------------------- */
function getApiKey(): string {
  const key = import.meta.env.VITE_GROQ_API_KEY
  if (!key) {
    throw new Error('VITE_GROQ_API_KEY не задан в переменных окружения')
  }
  return key
}

/* -------------------------------------------------------------------------- */
/*  Тест соединения                                                            */
/* -------------------------------------------------------------------------- */
export async function testConnection(): Promise<boolean> {
  try {
    const res = await axios.get<GroqModelListResponse>(`${API_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    })
    console.log('Доступно моделей:', res.data?.data?.length ?? 0)
    return res.status === 200
  } catch (e) {
    console.error('Тест соединения провален:', e)
    return false
  }
}

/* -------------------------------------------------------------------------- */
/*  Обычный запрос (без стриминга)                                            */
/* -------------------------------------------------------------------------- */
export async function sendMessage(
  messages: Message[],
  model: string,
  temperature = 0.7,
  maxTokens = 2000,
): Promise<string> {
  const payload = { model, messages, temperature, max_tokens: maxTokens }

  const res = await axios.post<GroqChatCompletionResponse>(
    `${API_BASE_URL}/chat/completions`,
    payload,
    {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    },
  )

  const content = res.data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Ответ от API не содержит текста')
  }
  return content
}

/* -------------------------------------------------------------------------- */
/*  Стриминговый запрос                                                       */
/* -------------------------------------------------------------------------- */
export async function sendMessageStream(
  messages: Message[],
  model: string,
  onChunk: (chunk: string) => void,
  /** Параметры, которые часто меняются */
  {
    temperature = 0.7,
    maxTokens = 4096,
    /** Таймаут в миллисекундах (по умолчанию 5 мин) */
    timeoutMs = 5 * 60 * 1000,
  }: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<void> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`HTTP ${res.status}: ${errText}`)
    }

    // Поток читаем построчно (каждая строка начинается с `data: `)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        // Если после завершения чтения остался «незавершённый» кусок – обработаем его
        if (buffer.trim()) processLine(buffer, onChunk)
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Выделяем полные строки, оставляя «хвост» в буфере
      let newlineIdx: number
      while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
        const rawLine = buffer.slice(0, newlineIdx).trim()
        buffer = buffer.slice(newlineIdx + 1) // оставляем остаток

        // Пустые строки в потоке могут встречаться – игнорируем
        if (!rawLine) continue

        // Обрабатываем только строки с префиксом `data: `
        if (rawLine.startsWith('data:')) {
          processLine(rawLine, onChunk)
        }
      }
    }
  } catch (err) {
    // Ошибки могут быть как сетевые, так и связанные с парсингом
    console.error('Ошибка стриминга:', err)
    throw err
  } finally {
    clearTimeout(timeoutId)
    controller.abort()
  }
}

/* -------------------------------------------------------------------------- */
/*  Внутренний парсер строки из потока                                         */
/* -------------------------------------------------------------------------- */
function processLine(line: string, onChunk: (c: string) => void): void {
  // Формат: `data: {...json...}`  или `data: [DONE]`
  const payload = line.replace(/^data:\s*/, '')

  if (payload === '[DONE]') {
    // Сервер закончил отправку – ничего больше не делаем
    return
  }

  if (!payload) return // иногда приходит просто `data: ` без данных

  try {
    const json: GroqChatCompletionResponse = JSON.parse(payload)
    const delta = json.choices?.[0]?.delta
    const content = delta?.content ?? ''
    if (content) onChunk(content)
  } catch (e) {
    // Если JSON «сломался», выводим в консоль и продолжаем работу
    console.warn('Не удалось распарсить строку из потока:', payload, e)
  }
}

/* -------------------------------------------------------------------------- */
/*  Пример использования (можно убрать в продакшн)                            */
/* -------------------------------------------------------------------------- */
// (async () => {
//   const ok = await testConnection()
//   console.log('Соединение OK?', ok)

//   const msgs: Message[] = [{ role: 'user', content: 'Привет, как тебя зовут?' }]
//   const model = availableModels[0].value

//   // Обычный запрос
//   const answer = await sendMessage(msgs, model)
//   console.log('Ответ без стрима:', answer)

//   // Стриминг
//   console.log('Ответ со стримом:')
//   await sendMessageStream(msgs, model, chunk => process.stdout.write(chunk))
// })()
