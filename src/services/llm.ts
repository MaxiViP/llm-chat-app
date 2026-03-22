/* ────────────────────────────────────────────────────────────────────────── *
 *  LLM‑провайдеры с поддержкой OpenAI‑совместимых API (Groq, OpenRouter)   *
 *  --------------------------------------------------------------- *
 *  • строгая типизация (Message, ModelOption, ProviderKey, …)            *
 *  • ротация API‑ключей, health‑check, кеширование списка моделей       *
 *  • потоковый запрос с автоматическим fallback‑механизмом               *
 *  • небольшие, но важные исправления (импорт axios, сравнение имён,      *
 *    корректный maxTokens, очистка кэша и т.д.)                           *
 * ────────────────────────────────────────────────────────────────────────── */

import axios from 'axios' // <-- работает при "esModuleInterop": true (рекомендовано)

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

/** Ключи провайдеров, которые поддерживает приложение */
export type ProviderKey = 'groq' | 'openrouter'

/** Возможные режимы (в текущей версии не используется, но оставлен для будущего) */
export type Mode = 'auto' | 'fast' | 'smart' | 'code' | 'manual'

/** Параметры, передаваемые в sendStream */
export interface SendStreamOptions {
  temperature?: number
  maxTokens?: number
}

/** Общий интерфейс провайдера */
interface LLMProvider {
  /** Человекочитаемое имя (для логов / UI) */
  readonly displayName: string
  /** Ключ, совпадающий с ProviderKey */
  readonly key: ProviderKey

  /** Получить список доступных моделей */
  getModels(): Promise<ModelOption[]>

  /** Отправить сообщения в режиме streaming */
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

  constructor(key: ProviderKey, displayName: string, baseUrl: string, apiKeys: string[]) {
    this.key = key
    this.displayName = displayName
    this.baseUrl = baseUrl
    this.apiKeys = apiKeys.filter(Boolean) // отбрасываем пустые строки
    if (!this.apiKeys.length) {
      throw new Error(`${displayName}: нет API‑ключей`)
    }
  }

  /** Возвращает текущий ключ и переключает указатель (round‑robin) */
  private getApiKey(): string {
    const key = this.apiKeys[this.keyIndex]
    this.keyIndex = (this.keyIndex + 1) % this.apiKeys.length
    return key
  }

  /* ------------------------------ health‑check ------------------------------ */
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

  /* ------------------------------ модели ------------------------------ */
  async getModels(): Promise<ModelOption[]> {
    if (this.modelCache.length) return this.modelCache

    try {
      const res = await axios.get(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.getApiKey()}` },
      })
      // Ожидаемый ответ: { data: [{ id: string }, …] }
      const data = (res.data as { data?: { id: string }[] }).data ?? []
      this.modelCache = data.map((m) => ({
        value: m.id,
        label: m.id,
      }))
      return this.modelCache
    } catch (e) {
      console.warn(`[${this.displayName}] не удалось загрузить модели`, e)
      return []
    }
  }

  /* ------------------------------ streaming ------------------------------ */
  async sendStream(
    messages: Message[],
    model: string,
    onChunk: (chunk: string) => void,
    options: SendStreamOptions = {},
  ): Promise<void> {
    const { temperature = 0.7, maxTokens } = options

    // «Безопасный» лимит токенов для OpenRouter (бесплатный план)
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

      // 402 — недостаточно кредитов (только у OpenRouter)
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
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[]
          }
          const content = json.choices?.[0]?.delta?.content
          if (content) onChunk(content)
        } catch {
          // Игнорируем некорректные строки (может быть «ping»‑сообщение)
        }
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

/* -------------------------------------------------------------------------- *
 *  Управление текущим провайдером                                            *
 * -------------------------------------------------------------------------- */
let currentProvider: ProviderKey = 'groq'

export function setProvider(p: ProviderKey): void {
  currentProvider = p
  // При переключении провайдера сбрасываем кэш моделей, чтобы они
  // заново подгрузились у нового бэкенда.
  delete availableModelsCache[p]
}

export function getProvider(): OpenAICompatibleProvider {
  return providers[currentProvider]
}

/* -------------------------------------------------------------------------- *
 *  Маппинг алиасов → реальных моделей                                         *
 * -------------------------------------------------------------------------- */
type ModelAlias = 'fast' | 'smart' | 'code'

const modelMap: Record<ModelAlias, Record<ProviderKey, string>> = {
  fast: {
    groq: 'llama-3.1-8b-instant',
    openrouter: 'qwen/qwen2.5-7b-instruct:free',
  },
  smart: {
    groq: 'llama-3.3-70b-versatile',
    openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  code: {
    groq: 'deepseek-r1-distill-llama-70b',
    openrouter: 'mistralai/mistral-nemo:free',
  },
}

/**
 * Преобразует алиас (`fast`, `smart`, `code`) в реальное имя модели
 * для указанного провайдера. Если передано уже полное имя модели –
 * возвращает его без изменений.
 *
 * @throws если алиас известен, но для текущего провайдера не задана модель.
 */
function resolveModel(model: string, provider: ProviderKey): string {
  const alias = modelMap[model as ModelAlias]
  if (alias) {
    const resolved = alias[provider]
    if (!resolved) {
      throw new Error(`Алиас модели "${model}" не поддерживается провайдером "${provider}"`)
    }
    return resolved
  }
  return model
}

/* -------------------------------------------------------------------------- *
 *  Порядок fallback‑провайдеров                                              *
 * -------------------------------------------------------------------------- */
const fallbackOrder: ProviderKey[] = ['groq', 'openrouter']

/* -------------------------------------------------------------------------- *
 *  Stream‑запрос с автоматическим fallback                                     *
 * -------------------------------------------------------------------------- */
export async function sendMessageStream(
  messages: Message[],
  model: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  // Сначала пробуем текущий провайдер, а затем остальные из fallback‑списка
  const order = [currentProvider, ...fallbackOrder.filter((k) => k !== currentProvider)]

  let lastError: unknown = null

  for (const key of order) {
    const provider = providers[key]
    try {
      const resolvedModel = resolveModel(model, key)
      console.log(`🚀 Пробуем ${provider.displayName} → ${resolvedModel}`)
      await provider.sendStream(messages, resolvedModel, onChunk)
      console.log(`✅ Успех через ${provider.displayName}`)
      return // запрос выполнен, дальше не идём
    } catch (err) {
      console.warn(`❌ ${provider.displayName} упал:`, err)
      lastError = err
    }
  }

  // Если дошли сюда – все провайдеры завершились ошибкой
  throw lastError ?? new Error('Все провайдеры упали')
}

/* -------------------------------------------------------------------------- *
 *  Упрощённый запрос (без streaming)                                         *
 * -------------------------------------------------------------------------- */
export async function sendMessage(messages: Message[], model: string): Promise<string> {
  let result = ''
  await sendMessageStream(messages, model, (chunk) => (result += chunk))
  return result
}

/* -------------------------------------------------------------------------- *
 *  Кеш доступных моделей                                                     *
 * -------------------------------------------------------------------------- */
const availableModelsCache: Record<ProviderKey, ModelOption[]> = {}

export async function getAvailableModels(provider?: ProviderKey): Promise<ModelOption[]> {
  const key = provider ?? currentProvider
  if (availableModelsCache[key]) return availableModelsCache[key]

  const models = await providers[key].getModels()
  availableModelsCache[key] = models
  return models
}
