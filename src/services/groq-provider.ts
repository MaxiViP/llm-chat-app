import axios, { AxiosInstance, AxiosError } from 'axios'
import type {
  ProviderInterface,
  ModelInfo,
  UsageLimits,
  UsageStats
} from '../types/llm'

interface GroqProviderOptions {
  apiKey: string
  model: string
  provider: 'groq'
}

class GroqProvider implements ProviderInterface {
  private axiosInstance: AxiosInstance
  private apiKeys: Map<string, string>
  private usageLimits: UsageLimits = { perMinute: 20, perDay: 50 }
  private currentUsage: UsageStats = { used: { perMinute: 0, perDay: 0 }, remaining: { perMinute: 0, perDay: 0 } }

  constructor(
    private options: GroqProviderOptions,
    private limitTracking: LimitTracker
  ) {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.groq.com/openai',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`
      }
    })
    
    this.apiKeys = new Map([
      ['groq', options.apiKey],
      ['openrouter', 'YOUR_OPENROUTER_API_KEY']
    ])
  }

  async initialize(): Promise<boolean> {
    try {
      // Загрузка информации о доступных моделях
      await this.loadAvailableModels()
      
      // Получение статистики использования
      const stats = await this.getUsageStats()
      this.currentUsage = stats
      
      return true
    } catch (error) {
      console.error('Ошибка инициализации провайдера:', error)
      return false
    }
  }

  async loadAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.axiosInstance.get('/models')
      const modelsData = response.data.result.models
      
      return modelsData.map(model => ({
        id: model.id,
        name: model.name,
        provider: 'groq',
        parameters: {
          maxTokens: model.max_tokens,
          temperature: 0.7,
          topP: 1.0
        },
        limits: {
          messagesPerMinute: 60,
          tokensPerMinute: 2_000_000,
          burnRate: 0.85
        }
      }))
    } catch (error) {
      console.error('Ошибка загрузки моделей:', error)
      return []
    }
  }

  async sendMessage(
    prompt: string,
    modelId: string,
    stream?: boolean
  ): Promise<string> {
    try {
      const model = this.getProviderModels().find(m => m.id === modelId)
      
      if (!model) throw new Error('Модель не найдена')

      // Проверка лимитов перед отправкой
      await this.checkLimits(model)

      const response = stream 
        ? await this.axiosInstance.post('/chat/completions', {
            model: model.id,
            prompt,
            stream: true
          }, { responseType: 'stream' })
        : await this.axiosInstance.post('/chat/completions', {
            model: model.id,
            prompt,
            stream: false
          })

      if (stream) {
        const reader = response.data.response.stream.readable
        let responseText = ''
        
        for await (const chunk of reader) {
          const decoded = Buffer.from(chunk).toString('utf-8')
          responseText += decoded
          
          // Обновление статистики в фоновом режиме
          this.updateUsageStats(decoded.length, 'groq')
        }
        
        return responseText
      }

      return response.data.response.choices[0].delta.content || ''
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error)
      throw error
    }
  }

  async checkLimits(model: ModelInfo): Promise<boolean> {
    const usage = this.currentUsage.used
    const limit = model.limits.burnRate
    
    if (usage.perMinute > limit) {
      console.warn(`Достигнут лимит использования для ${model.name}`)
      return false
    }
    
    return true
  }

  updateUsageStats(bytes: number, provider: string): void {
    this.currentUsage.used.perMinute += bytes
    this.currentUsage.used.perDay += bytes
    
    // Обновление статистики использования
    this.calculateUsagePercentages()
  }

  calculateUsagePercentages(): void {
    this.currentUsage.remaining.perMinute = 
      this.usageLimits.perMinute - this.currentUsage.used.perMinute
  
    this.currentUsage.remaining.perDay = 
      this.usageLimits.perDay - this.currentUsage.used.perDay
  
    this.currentUsage.percent.perMinute =
      (this.currentUsage.used.perMinute / this.usageLimits.perMinute) * 100
  
    this.currentUsage.percent.perDay =
      (this.currentUsage.used.perDay / this.usageLimits.perDay) * 100
  }

  getProviderModels(): ModelInfo[] {
    return [
      {
        id: 'llama3-8b',
        name: 'Llama3 8B',
        provider: 'groq',
        parameters: {
          maxTokens: 8192,
          temperature: 0.7,
          topP: 1.0
        },
        limits: {
          messagesPerMinute: 60,
          tokensPerMinute: 2_000_000,
          burnRate: 0.85
        }
      },
      {
        id: 'mixtral-8x7b',
        name: 'Mixtral 8x7B',
        provider: 'groq',
        parameters: {
          maxTokens: 16384,
          temperature: 0.6,
          topP: 0.95
        },
        limits: {
          messagesPerMinute: 45,
          tokensPerMinute: 2_500_000,
          burnRate: 0.78
        }
      }
    ]
  }

  getLimits(): UsageLimits {
    return this.usageLimits
  }

  getUsage(): UsageStats {
    return this.currentUsage
  }
}

export { GroqProvider }