import axios from 'axios'

/* -------------------------------------------------------------------------- *
 *  Типы                                                                      *
 * -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- *
 *  OpenAI‑совместимый провайдер                                               *
 * -------------------------------------------------------------------------- */
class OpenAICompatibleProvider implements LLMProvider {
  readonly key: ProviderKey
  readonly displayName: string
  private readonly baseUrl: string
  private readonly apiKeys: string[]
  private keyIndex = 0
  private modelCache: ModelOption[] = []

  // Лимиты OpenRouter
  private remainingPerMinute = 20
  private remainingPerDay = 50
  private lastRequestTimestamp = 0
  private dayStartTimestamp = Date.now()

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

  /** Получить текущие лимиты для UI */
  getLimits(): { perMinute: number; perDay: number } {
    const now = Date.now()
    if (now - this.lastRequestTimestamp > 60_000) this.remainingPerMinute = 20
    if (now - this.dayStartTimestamp > 24 * 60 * 60_000) {
      this.remainingPerDay = 50
      this.dayStartTimestamp = now
    }
    return { perMinute: this.remainingPerMinute, perDay: this.remainingPerDay }
  }

  /** Снять один запрос с лимита */
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
    if (this.modelCache.length) return this.modelCache
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
        onChunk(
          `(Лимиты исчерпаны: ${limits.perMinute} запросов/мин, ${limits.perDay} запросов/день)`,
        )
        return
      }
      onChunk(
        `(Лимиты OpenRouter: ${limits.perMinute} запросов/мин, ${limits.perDay} запросов/день)`,
      )
      this.consumeLimit()
    }

    const { temperature = 0.7, maxTokens } = options
    const finalMaxTokens =
      this.key === 'openrouter' ? Math.min(maxTokens ?? 4096, 200) : (maxTokens ?? 8192)

    const controller = new AbortController()
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
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
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      if (this.key === 'openrouter' && res.status === 402) {
        onChunk(`(ответ прерван: ${errText.replace(/\n/g, ' ')})`)
        return
      }
      throw new Error(`[${this.displayName}] ${res.status}: ${errText}`)
    }

    const reader = res.body!.getReader()
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
        } catch {}
      }
    }
  }
}

/* -------------------------------------------------------------------------- *
 *  Инициализация провайдеров                                                  *
 * -------------------------------------------------------------------------- */
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
  delete availableModelsCache[p]
}

export function getProvider(): OpenAICompatibleProvider {
  return providers[currentProvider]
}

/* -------------------------------------------------------------------------- *
 *  Получение лимитов для UI                                                   *
 * -------------------------------------------------------------------------- */
export function getProviderLimits(provider?: ProviderKey): { perMinute: number; perDay: number } {
  const p = provider ? providers[provider] : getProvider()
  return p.key === 'openrouter' ? p.getLimits() : { perMinute: Infinity, perDay: Infinity }
}

/* -------------------------------------------------------------------------- *
 *  Остальной код (sendMessage, sendMessageStream, getAvailableModels…)       *
 * -------------------------------------------------------------------------- */
type ModelAlias = 'fast' | 'smart' | 'code'
const modelMap: Record<ModelAlias, Record<ProviderKey, string>> = {
  fast: { groq: 'llama-3.1-8b-instant', openrouter: 'qwen/qwen2.5-7b-instruct:free' },
  smart: { groq: 'llama-3.3-70b-versatile', openrouter: 'meta-llama/llama-3.3-70b-instruct:free' },
  code: { groq: 'deepseek-r1-distill-llama-70b', openrouter: 'mistralai/mistral-nemo:free' },
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
