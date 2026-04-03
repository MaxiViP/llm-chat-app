// Типы провайдеров
export type ProviderKey = 'groq' | 'openrouter'

// ---- МОДЕЛИ ----
export interface ModelParameters {
  maxTokens: number
  temperature: number
  topP: number
}

export interface ModelLimits {
  messagesPerMinute: number
  tokensPerMinute: number
  burnRate: number
}

export interface ModelInfo {
  id: string
  name: string
  provider: ProviderKey
  parameters: ModelParameters
  limits: ModelLimits
}

// ---- ЛИМИТЫ ----
export interface UsageLimits {
  perMinute: number
  perDay: number
}

export interface UsageStats {
  used: {
    perMinute: number
    perDay: number
  }
  remaining: {
    perMinute: number
    perDay: number
  }
  percent: {
    perMinute: number
    perDay: number
  }
}

// ---- LIMIT TRACKER ----
export interface LimitInfo {
  providerId: string
  used: number
  limit: number
  percentUsed: number
  remaining: number
}

// ---- ПРОВАЙДЕР ----
export interface ProviderInterface {
  initialize(): Promise<boolean>

  loadAvailableModels(): Promise<ModelInfo[]>

  sendMessage(prompt: string, modelId: string, stream?: boolean): Promise<string>

  getLimits(): UsageLimits

  getUsage(): UsageStats

  checkLimits(model: ModelInfo): Promise<boolean>
}
