import axios from 'axios'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ModelOption {
  value: string
  label: string
}

export type ProviderKey = 'groq' | 'openrouter'
export type Mode = 'auto' | 'fast' | 'smart' | 'code' | 'manual'

export interface SendStreamOptions {
  temperature?: number
  maxTokens?: number
}

interface LLMProvider {
  readonly displayName: string
  readonly key: ProviderKey
  getModels(): Promise<ModelOption[]>
  sendStream(
    messages: Message[],
    model: string,
    onChunk: (chunk: string) => void,
    options?: SendStreamOptions,
  ): Promise<void>
}

class OpenAICompatibleProvider implements LLMProvider {
  readonly key: ProviderKey
  readonly displayName: string
  private readonly baseUrl: string
  private readonly apiKeys: string[]
  private keyIndex = 0
  private modelCache: ModelOption[] | null = null

  private remainingPerMinute = 20
  private remainingPerDay = 50
  private lastRequestTimestamp = Date.now()
  private dayStartTimestamp = this.lastRequestTimestamp

  constructor(key: ProviderKey, displayName: string, baseUrl: string, apiKeys: string[]) {
    this.key = key
    this.displayName = displayName
    this.baseUrl = baseUrl
    this.apiKeys = apiKeys.filter(Boolean)
    if (!this.apiKeys.length) throw new Error(`${displayName}: нет API‑ключей`)
  }

  private getApiKey(): string {
    const key = this.apiKeys[this.keyIndex]
    this.keyIndex = (this.keyIndex + 1) % this.apiKeys.length
    return key
  }

  getLimits(): { perMinute: number; perDay: number } {
    const now = Date.now()
    if (now - this.lastRequestTimestamp > 60_000) this.remainingPerMinute = 20
    if (now - this.dayStartTimestamp > 24 * 60 * 60_000) {
      this.remainingPerDay = 50
      this.dayStartTimestamp = now
    }
    return { perMinute: this.remainingPerMinute, perDay: this.remainingPerDay }
  }

  private consumeLimit() {
    if (this.key === 'openrouter') {
      this.remainingPerMinute = Math.max(0, this.remainingPerMinute - 1)
      this.remainingPerDay = Math.max(0, this.remainingPerDay - 1)
      this.lastRequestTimestamp = Date.now()
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.getApiKey()}` },
        timeout: 3000,
      })
      return res.status === 200
    } catch {
      return false
    }
  }

  async getModels(): Promise<ModelOption[]> {
    if (this.modelCache) return this.modelCache

    try {
      const res = await axios.get(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.getApiKey()}` },
      })
      const data = (res.data as { data?: { id: string }[] }).data ?? []
      this.modelCache = data.map((m) => ({ value: m.id, label: m.id }))
      return this.modelCache
    } catch (e) {
      console.warn(`[${this.displayName}] не удалось загрузить модели`, e)
      return []
    }
  }

  async sendStream(
    messages: Message[],
    model: string,
    onChunk: (chunk: string) => void,
    options: SendStreamOptions = {},
  ): Promise<void> {
    if (this.key === 'openrouter') {
      const limits = this.getLimits()
      if (limits.perMinute <= 0 || limits.perDay <= 0) {
        throw new Error(
          `Лимиты исчерпаны: ${limits.perMinute} запросов/мин, ${limits.perDay} запросов/день`,
        )
      }
      this.consumeLimit()
    }

    const { temperature = 0.7, maxTokens } = options
    const finalMaxTokens =
      this.key === 'openrouter' ? Math.min(maxTokens ?? 1024, 1500) : (maxTokens ?? 8192)

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: finalMaxTokens,
          stream: true,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        if (this.key === 'openrouter' && response.status === 402) {
          throw new Error(`OpenRouter лимит токенов: ${errText}`)
        }
        throw new Error(`[${this.displayName}] ${response.status}: ${errText}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        let newlineIdx: number
        while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIdx).trim()
          buffer = buffer.slice(newlineIdx + 1)

          if (!line.startsWith('data:')) continue

          const payload = line.slice(5).trim()
          if (payload === '[DONE]') return

          try {
            const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }
            const content = json.choices?.[0]?.delta?.content

            if (content) onChunk(content)
          } catch (error) {
            console.error('Ошибка при декодировании JSON:', error)
          }
        }
      }
    } catch (error) {
      console.error(`Ошибка в sendStream:`, error)
      throw new Error(`Сбой при отправке данных через ${this.displayName}: ${error.message}`)
    }
  }
}

const providers: Record<ProviderKey, OpenAICompatibleProvider> = {
  groq: new OpenAICompatibleProvider('groq', 'Groq', 'https://api.groq.com/openai/v1', [
    import.meta.env.VITE_GROQ_API_KEY,
  ]),
  openrouter: new OpenAICompatibleProvider(
    'openrouter',
    'OpenRouter',
    'https://openrouter.ai/api/v1',
    [import.meta.env.VITE_OPENROUTER_API_KEY],
  ),
}

let currentProvider: ProviderKey = 'groq'

export function setProvider(p: ProviderKey): void {
  currentProvider = p
  if (providers[p].modelCache) providers[p].modelCache = null // Очистка кэша моделей
}

export function getProvider(): OpenAICompatibleProvider {
  return providers[currentProvider]
}

export function getProviderLimits(provider?: ProviderKey): { perMinute: number; perDay: number } {
  const p = provider ? providers[provider] : getProvider()
  return p.key === 'openrouter' ? p.getLimits() : { perMinute: Infinity, perDay: Infinity }
}

type ModelAlias = 'fast' | 'smart' | 'code'
const modelMap: Record<ModelAlias, Record<ProviderKey, string>> = {
  fast: { groq: 'llama-3.1-8b-instant', openrouter: 'qwen/qwen2.5-7b-instruct:free' },
  smart: { groq: 'llama-3.3-70b-versatile', openrouter: 'meta-llama/llama-3.3-70b-instruct:free' },
  code: {
    groq: 'deepseek-r1-distill-llama-70b',
    openrouter: 'mistralai/mistral-nemo:free',
  },
}

function resolveModel(model: string, provider: ProviderKey): string {
  const alias = modelMap[model as ModelAlias]
  if (alias) {
    const resolved = alias[provider]
    if (!resolved)
      throw new Error(`Алиас модели "${model}" не поддерживается провайдером "${provider}"`)
    return resolved
  }
  return model
}

const fallbackOrder: ProviderKey[] = ['groq', 'openrouter']

export async function sendMessageStream(
  messages: Message[],
  model: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const order = [currentProvider, ...fallbackOrder.filter((k) => k !== currentProvider)]
  let lastError: unknown = null

  for (const key of order) {
    const provider = providers[key]
    try {
      const resolvedModel = resolveModel(model, key)
      console.log(`🚀 Пробуем ${provider.displayName} → ${resolvedModel}`)
      await provider.sendStream(messages, resolvedModel, onChunk)
      console.log(`✅ Успех через ${provider.displayName}`)
      return
    } catch (err) {
      console.warn(`❌ ${provider.displayName} упал:`, err)
      lastError = err
    }
  }

  throw lastError ?? new Error('Все провайдеры упали')
}

export async function sendMessage(messages: Message[], model: string): Promise<string> {
  let result = ''
  await sendMessageStream(messages, model, (chunk) => (result += chunk))
  return result
}

const availableModelsCache: Record<ProviderKey, ModelOption[]> = {}
export async function getAvailableModels(provider?: ProviderKey): Promise<ModelOption[]> {
  const key = provider ?? currentProvider
  if (availableModelsCache[key]) return availableModelsCache[key]
  const models = await providers[key].getModels()
  availableModelsCache[key] = models
  return models
}

const DEFAULT_FALLBACK_MODELS = [
  { provider: 'groq' as ProviderKey, model: 'llama-3.3-70b-versatile', name: 'Groq Llama 70B' },
  { provider: 'groq' as ProviderKey, model: 'llama-3.1-8b-instant', name: 'Groq Llama 8B' },
  {
    provider: 'openrouter' as ProviderKey,
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'OpenRouter Llama 70B',
  },
  {
    provider: 'openrouter' as ProviderKey,
    model: 'qwen/qwen2.5-7b-instruct:free',
    name: 'OpenRouter Qwen 7B',
  },
  {
    provider: 'openrouter' as ProviderKey,
    model: 'mistralai/mistral-nemo:free',
    name: 'OpenRouter Mistral Nemo',
  },
]

export function isResponseValid(content: string, minLength: number = 10): boolean {
  if (!content || content.trim().length === 0) return false
  if (content.trim().length < minLength) return false

  const trimmed = content.trim().toLowerCase()
  const invalidResponses = [
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

  return !invalidResponses.includes(trimmed)
}

export function getFallbackResponse(userInput: string): string {
  const responses = [
    `Извините, сервис временно недоступен. Попробуйте позже. Ваш запрос: "${userInput.slice(0, 50)}${userInput.length > 50 ? '...' : ''}"`,
    `К сожалению, не удалось обработать запрос. Пожалуйста, переформулируйте вопрос.`,
    `Технические неполадки. Наши инженеры уже работают над исправлением.`,
    `Не могу ответить сейчас. Попробуйте позже или задайте другой вопрос.`,
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

export async function sendMessageWithGuaranteedResponse(
  messages: Message[],
  onChunk: (chunk: string) => void,
  options: {
    minLength?: number
    maxAttempts?: number
    models?: Array<{ provider: ProviderKey; model: string; name: string }>
  } = {},
): Promise<string> {
  const { minLength = 10, maxAttempts = 5, models = DEFAULT_FALLBACK_MODELS } = options

  let lastError: any = null
  let currentAttempt = 0

  for (const modelConfig of models) {
    if (currentAttempt >= maxAttempts) break
    currentAttempt++

    try {
      console.log(`🚀 Попытка ${currentAttempt}/${maxAttempts}: ${modelConfig.name}`)

      let response = ''

      const originalProvider = currentProvider
      setProvider(modelConfig.provider)

      await sendMessageStream(messages, modelConfig.model, (chunk) => {
        response += chunk
        onChunk(chunk)
      })

      if (isResponseValid(response, minLength)) {
        console.log(`✅ Успешный ответ от ${modelConfig.name}, длина: ${response.length}`)
        return response
      } else {
        console.warn(
          `⚠️ Ответ от ${modelConfig.name} слишком короткий (${response?.length || 0} символов)`,
        )
        onChunk('')
        lastError = new Error('Пустой или слишком короткий ответ')
      }
    } catch (err) {
      console.warn(`❌ Ошибка при запросе к ${modelConfig.name}:`, err)
      lastError = err
      onChunk('')
    }
  }

  throw lastError || new Error('Не удалось получить качественный ответ ни от одной модели')
}

export async function sendMessageStreamWithFallback(
  messages: Message[],
  onChunk: (chunk: string, metadata?: { model?: string; attempt?: number }) => void,
  options: {
    minLength?: number
    models?: Array<{ provider: ProviderKey; model: string; name: string }>
  } = {},
): Promise<void> {
  const { minLength = 10, models = DEFAULT_FALLBACK_MODELS } = options

  let lastError: any = null

  for (let i = 0; i < models.length; i++) {
    const modelConfig = models[i]
    try {
      let response = ''

      const originalProvider = currentProvider
      setProvider(modelConfig.provider)

      await sendMessageStream(messages, modelConfig.model, (chunk) => {
        response += chunk
        onChunk(chunk, { model: modelConfig.name, attempt: i + 1 })
      })

      if (isResponseValid(response, minLength)) {
        console.log(`✅ Успешный стриминг от ${modelConfig.name}`)
        return
      }

      console.warn(`⚠️ Ответ от ${modelConfig.name} слишком короткий, пробуем дальше...`)
      lastError = new Error('Пустой или слишком короткий ответ')
    } catch (err) {
      console.warn(`❌ Ошибка при запросе к ${modelConfig.name}:`, err)
      lastError = err
    }
  }

  throw lastError || new Error('Не удалось получить ответ')
}
