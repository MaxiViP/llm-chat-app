import axios from 'axios'

const API_BASE_URL = '/api/groq'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export const availableModels = [
  // Llama семейство (самые популярные и быстрые на Groq)
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile — мощная, универсальная' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant — очень быстрая, лёгкая' },
  { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile — классика 2024–2025' },

  // Llama 4 серия (новые, мультимодальные, tool-use)
  { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B — мультимодальная, instruct' },
  { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B 128k — большая контекстность' },

  // Gemma от Google
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B Instruct — компактная и умная' },
  { value: 'gemma-7b-it', label: 'Gemma 7B Instruct — ещё легче и быстрее' },

  // Mixtral / Mistral
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32768 — MoE, хороший баланс' },

  // DeepSeek и китайские модели
  { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B — сильная в коде/математике' },

  // OpenAI-совместимые / OSS от OpenAI через Groq
  { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B — OpenAI open-weight, быстрая' },
  { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B — самая мощная open-weight на Groq' },

  // Другие интересные / специализированные (если доступны в твоём аккаунте)
  { value: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2 Instruct — сильная китайская модель' },
  { value: 'qwen/qwen3-32b', label: 'Qwen 3 32B — отличная в многоязычности' },

  // Старые / legacy (можно оставить для тестов, но лучше не использовать в проде)
  { value: 'llama3-70b-8192', label: 'Llama 3 70B (старый ID) — legacy' },
  { value: 'llama3-8b-8192', label: 'Llama 3 8B (старый ID) — legacy' },
];
// Проверка доступности API (список моделей)
export async function testConnection(): Promise<boolean> {
  try {
    const response = await axios.get(`${API_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    return response.status === 200
  } catch (error) {
    console.error('Connection test failed:', error)
    return false
  }
}

// Обычный (не-стрим) запрос
export async function sendMessage(messages: Message[], model: string): Promise<string> {
  try {
    console.log('Sending request to:', `${API_BASE_URL}/chat/completions`)
    console.log('Model:', model)
    console.log('Messages:', messages)

    const response = await axios.post(
      `${API_BASE_URL}/chat/completions`,
      {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )

    console.log('Response:', response.data)
    return response.data.choices[0].message.content as string
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('API Error Details:', {
        status: error.response.status,
        data: error.response.data,
      })
    } else {
      console.error('API Error:', error)
    }
    throw error
  }
}

// Потоковый запрос (streaming)
export async function sendMessageStream(
  messages: Message[],
  model: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  try {
    console.log('Stream request to:', `${API_BASE_URL}/chat/completions`)

    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    if (!response.body) {
      throw new Error('No response body for streaming')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        // Обязательно обработать остаток буфера при завершении потока!
        if (buffer.trim()) {
          processLine(buffer)
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n')
      while (boundary >= 0) {
        const line = buffer.slice(0, boundary).trim()
        buffer = buffer.slice(boundary + 1)

        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            console.log('Stream completed ([DONE])')
            continue
          }
          if (!data) continue // пустой data: — heartbeat, игнорируем

          try {
            const parsed = JSON.parse(data)
            const contentDelta = parsed.choices?.[0]?.delta?.content ?? ''
            if (contentDelta) {
              onChunk(contentDelta)
            }
          } catch (parseErr) {
            console.warn('Failed to parse SSE data:', data, parseErr)
          }
        }

        boundary = buffer.indexOf('\n')
      }
    }

    // Финальная очистка — иногда последний чанк без \n
    if (buffer.trim()) {
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim()
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data)
            const contentDelta = parsed.choices?.[0]?.delta?.content ?? ''
            if (contentDelta) onChunk(contentDelta)
          } catch {}
        }
      }
    }
  } catch (error) {
    console.error('Streaming failed:', error)
    throw error
  }
}

// Вспомогательная функция внутри (можно вынести, но для простоты оставляем здесь)
function processLine(line: string) {
  if (!line.startsWith('data: ')) return
  const data = line.slice(6).trim()
  if (data === '[DONE]' || !data) return

  try {
    const parsed = JSON.parse(data)
    const content = parsed.choices?.[0]?.delta?.content
    if (content) {
      onChunk(content)
    }
  } catch (e) {
    console.warn('Parse error in final buffer:', e)
  }
}
