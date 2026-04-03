// Лимит-трекер для всех провайдеров
export interface LimitInfo {
  providerId: string
  used: number
  limit: number
  percentUsed: number
  remaining: number
}

export class LimitTracker {
  private usage: Record<string, number> = {}
  private limits: Record<string, number> = {}

  constructor() {
    this.loadLimits()
  }

  async loadLimits(): Promise<void> {
    try {
      const limits = await this.fetchLimits()
      this.limits = limits

      const usage = await this.fetchUsage()
      this.usage = usage
    } catch (error) {
      console.error('Ошибка загрузки лимитов:', error)
    }
  }

  // Регистрация нового провайдера
  registerProvider(providerId: string, limit: number): void {
    if (!this.limits[providerId]) {
      this.limits[providerId] = limit
      this.saveLimits()
    }
  }

  // Запись использования
  recordUsage(providerId: string, bytes: number): void {
    if (this.usage[providerId] === undefined) {
      this.usage[providerId] = 0
    }

    this.usage[providerId] += bytes
    this.saveUsage()

    // Проверка превышения лимита
    this.checkLimit(providerId)
  }

  // Получение информации о лимите
  getLimitInfo(providerId: string): LimitInfo {
    const usage = this.usage[providerId] || 0
    const limit = this.limits[providerId] || 0

    return {
      providerId,
      used: usage,
      limit,
      percentUsed: limit ? (usage / limit) * 100 : 0,
      remaining: limit - usage,
    }
  }

  // Проверка доступности провайдера
  isProviderAvailable(providerId: string): boolean {
    const info = this.getLimitInfo(providerId)
    return info.remaining > 0
  }

  // Сохранение данных
  private saveUsage(): void {
    // Логика сохранения использования
  }

  private saveLimits(): void {
    // Логика сохранения лимитов
  }

  // Функции загрузки (placeholder)
  private fetchLimits(): Promise<Record<string, number>> {
    return new Promise((resolve) =>
      resolve({
        groq: 1000,
        openai: 500,
        anthropic: 800,
      }),
    )
  }

  private fetchUsage(): Promise<Record<string, number>> {
    return new Promise((resolve) =>
      resolve({
        groq: 234,
        openai: 123,
        anthropic: 456,
      }),
    )
  }

  // Проверка превышения лимита
  private checkLimit(providerId: string): void {
    const info = this.getLimitInfo(providerId)

    if (info.used > info.limit) {
      throw new Error(`Лимит превышен для провайдера: ${providerId}`)
    }
  }
}
