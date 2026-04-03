import axios from 'axios'

/* =====================
   TYPES
===================== */

export type ProviderKey = 'groq' | 'openrouter'

export type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type ModelOption = {
  value: string
  label: string
}

/* =====================
   PROVIDER LIMITS
===================== */

export function getProviderLimits(provider: ProviderKey) {
  if (provider === 'openrouter') {
    return {
      perMinute: 0, // 👉 если нет кредитов — сразу отключаем
      perDay: 0,
    }
  }

  return {
    perMinute: 100,
    perDay: 10000,
  }
}

/* =====================
   BASE PROVIDER
===================== */

abstract class BaseProvider {
  abstract baseUrl: string
  abstract getApiKey(): string

  public modelCache: ModelOption[] = []

  async getModels(): Promise<ModelOption[]> {
    if (this.modelCache.length) return this.modelCache

    try {
      type OpenAIModel = { id: string }
      type ModelsResponse = { data: OpenAIModel[] }

      const res = await axios.get<ModelsResponse>(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
        },
      })

      const data = res.data.data ?? []

      this.modelCache = data.map((m) => ({
        value: m.id,
        label: m.id,
      }))

      return this.modelCache
    } catch {
      return []
    }
  }

  async sendStream(
    messages: Message[],
    model: string,
    onChunk: (chunk: string) => void,
  ): Promise<void> {
    const res = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model,
        messages,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      },
    )

    return new Promise((resolve, reject) => {
      res.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n')

        for (const line of lines) {
          if (!line.startsWith('data:')) continue

          const json = line.replace('data:', '').trim()

          if (json === '[DONE]') {
            resolve()
            return
          }

          try {
            const parsed = JSON.parse(json)
            const content = parsed.choices?.[0]?.delta?.content ?? ''

            if (content) onChunk(content)
          } catch {
            // ignore
          }
        }
      })

      res.data.on('end', resolve)
      res.data.on('error', reject)
    })
  }
}

/* =====================
   PROVIDERS
===================== */

class GroqProvider extends BaseProvider {
  baseUrl = 'https://api.groq.com/openai/v1'

  getApiKey() {
    return import.meta.env.VITE_GROQ_API_KEY
  }
}

class OpenRouterProvider extends BaseProvider {
  baseUrl = 'https://openrouter.ai/api/v1'

  getApiKey() {
    return import.meta.env.VITE_OPENROUTER_API_KEY
  }
}

const providers: Record<ProviderKey, BaseProvider> = {
  groq: new GroqProvider(),
  openrouter: new OpenRouterProvider(),
}

/* =====================
   RANDOM ENGINE
===================== */

let requestCount = 0

let currentSelection: {
  provider: ProviderKey
  model: string
} = {
  provider: 'groq',
  model: 'llama-3.1-8b-instant',
}

const MODEL_POOL: Record<ProviderKey, string[]> = {
  groq: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b'],
  openrouter: [
    'qwen/qwen2.5-7b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-nemo:free',
  ],
}

export function pickRandom<T>(arr: T[]): T {
  if (!arr.length) {
    throw new Error('Empty array')
  }
  return arr[Math.floor(Math.random() * arr.length)]!
}

export function isOpenRouterAvailable(): boolean {
  const limits = getProviderLimits('openrouter')
  return limits.perMinute > 0 && limits.perDay > 0
}

export function randomizeProviderAndModel() {
  let providersList: ProviderKey[] = ['groq', 'openrouter']

  if (!isOpenRouterAvailable()) {
    providersList = ['groq']
  }

  const provider = pickRandom(providersList)
  const model = pickRandom(MODEL_POOL[provider])

  currentSelection = { provider, model }

  console.log(`🎲 Новый выбор: ${provider} → ${model}`)
}

/* =====================
   MAIN FUNCTION
===================== */

export async function sendMessageStream(
  messages: Message[],
  _model: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  requestCount++

  if (requestCount % 3 === 1) {
    randomizeProviderAndModel()
  }

  const { provider, model } = currentSelection

  try {
    console.log(`🚀 Используем: ${provider} → ${model}`)

    await providers[provider].sendStream(messages, model, onChunk)

    console.log(`✅ Успех: ${provider}`)
    return
  } catch (err) {
    console.warn(`❌ Ошибка: ${provider}`, err)

    const fallbackProvider: ProviderKey = provider === 'groq' ? 'openrouter' : 'groq'

    if (fallbackProvider === 'openrouter' && !isOpenRouterAvailable()) {
      throw err
    }

    const fallbackModel = pickRandom(MODEL_POOL[fallbackProvider])

    console.log(`🔁 fallback → ${fallbackProvider}: ${fallbackModel}`)

    await providers[fallbackProvider].sendStream(messages, fallbackModel, onChunk)
  }
}

/* =====================
   EXTERNAL CONTROL
===================== */

let forcedProvider: ProviderKey | null = null

export function setProvider(provider: ProviderKey) {
  forcedProvider = provider
}

export async function getAvailableModels(provider: ProviderKey): Promise<ModelOption[]> {
  return providers[provider].getModels()
}
