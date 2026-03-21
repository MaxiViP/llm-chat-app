import axios from 'axios'

const API_BASE_URL = 'https://api.groq.com/openai/v1' // ПРЯМОЙ Groq API — стриминг работает идеально

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export const availableModels = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile — мощная' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant — очень быстрая' },
  { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile — классика' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B Instruct — компактная' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B — хороший баланс' },
  { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B — сильная в коде' },
]

// Проверка соединения
export async function testConnection(): Promise<boolean> {
  try {
    const res = await axios.get(`${API_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
      },
    })
    console.log('Доступно моделей:', res.data.data?.length || 0)
    return res.status === 200
  } catch (e) {
    console.error('Тест соединения провален:', e)
    return false
  }
}

// Обычный запрос (можно не использовать, но оставляем)
export async function sendMessage(messages: Message[], model: string): Promise<string> {
  const res = await axios.post(
    `${API_BASE_URL}/chat/completions`,
    { model, messages, temperature: 0.7, max_tokens: 2000 },
    { headers: { Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}` } },
  )
  return res.data.choices[0].message.content
}

// Потоковый запрос — самый важный, надёжный парсер
export async function sendMessageStream(
  messages: Message[],
  model: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 300000) // 5 мин

  try {
    const res = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096, // большой лимит — чтобы не обрезало
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        if (buffer.trim()) processLine(buffer)
        console.log('Стрим завершён (done)')
        break
      }

      buffer += decoder.decode(value, { stream: true })

      let pos: number
      while ((pos = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, pos).trim()
        buffer = buffer.slice(pos + 1)

        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            console.log('[DONE] получен — завершаем')
            return
          }
          if (!data) continue

          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content || ''
            if (content) onChunk(content)
          } catch (e) {
            console.warn('Ошибка парсинга:', data, e)
          }
        }
      }
    }

    // Остаток
    if (buffer.trim()) processLine(buffer)
  } catch (err: any) {
    console.error('Ошибка стрима:', err)
    throw err
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

function processLine(line: string) {
  if (!line.startsWith('data: ')) return
  const data = line.slice(6).trim()
  if (data === '[DONE]' || !data) return

  try {
    const json = JSON.parse(data)
    const content = json.choices?.[0]?.delta?.content || ''
    if (content) onChunk(content)
  } catch {}
}
