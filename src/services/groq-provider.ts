import axios, { type AxiosInstance, type AxiosError } from 'axios'
import type { ProviderInterface, ModelInfo, UsageLimits, UsageStats } from '../types/llm'

// Определение интерфейса для LimitTracker
interface LimitTracker {
	checkLimit(modelId: string): Promise<boolean>
	trackUsage(modelId: string, tokens: number): void
}

interface GroqProviderOptions {
	apiKey: string
	model: string
	provider: 'groq'
}

interface GroqModelResponse {
	id: string
	name: string
	max_tokens: number
}

class GroqProvider implements ProviderInterface {
	private axiosInstance: AxiosInstance
	private apiKeys: Map<string, string>
	private usageLimits: UsageLimits = { perMinute: 20, perDay: 50 }
	private currentUsage: UsageStats = {
		used: { perMinute: 0, perDay: 0 },
		remaining: { perMinute: 0, perDay: 0 },
		percent: { perMinute: 0, perDay: 0 },
	}

	constructor(
		private options: GroqProviderOptions,
		private limitTracking: LimitTracker,
	) {
		this.axiosInstance = axios.create({
			baseURL: 'https://api.groq.com/openai',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				Authorization: `Bearer ${options.apiKey}`,
			},
		})

		this.apiKeys = new Map([
			['groq', options.apiKey],
			['openrouter', 'YOUR_OPENROUTER_API_KEY'],
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

	async getUsageStats(): Promise<UsageStats> {
		// Реальная реализация должна получать статистику из API
		return {
			used: { perMinute: 0, perDay: 0 },
			remaining: { perMinute: this.usageLimits.perMinute, perDay: this.usageLimits.perDay },
			percent: { perMinute: 0, perDay: 0 },
		}
	}

	async loadAvailableModels(): Promise<ModelInfo[]> {
		try {
			const response = await this.axiosInstance.get('/models')
			const modelsData = response.data.result?.models || response.data.data || []

			if (!Array.isArray(modelsData)) {
				return this.getProviderModels()
			}

			return modelsData.map((model: GroqModelResponse) => ({
				id: model.id,
				name: model.name,
				provider: 'groq',
				parameters: {
					maxTokens: model.max_tokens || 8192,
					temperature: 0.7,
					topP: 1.0,
				},
				limits: {
					messagesPerMinute: 60,
					tokensPerMinute: 2_000_000,
					burnRate: 0.85,
				},
			}))
		} catch (error) {
			console.error('Ошибка загрузки моделей:', error)
			return this.getProviderModels()
		}
	}

	async sendMessage(prompt: string, modelId: string, stream?: boolean): Promise<string> {
		try {
			const model = this.getProviderModels().find(m => m.id === modelId)

			if (!model) {
				throw new Error(`Модель ${modelId} не найдена`)
			}

			// Проверка лимитов перед отправкой
			await this.checkLimits(model)

			const response = stream
				? await this.axiosInstance.post(
						'/chat/completions',
						{
							model: model.id,
							messages: [{ role: 'user', content: prompt }],
							stream: true,
						},
						{ responseType: 'stream' },
					)
				: await this.axiosInstance.post('/chat/completions', {
						model: model.id,
						messages: [{ role: 'user', content: prompt }],
						stream: false,
					})

			if (stream && response.data) {
				// Обработка stream ответа
				let responseText = ''

				// Здесь должна быть реализация обработки stream
				// В зависимости от формата ответа Groq API

				return responseText
			}

			const data = response.data
			return data.choices?.[0]?.message?.content || data.response?.choices?.[0]?.delta?.content || ''
		} catch (error) {
			console.error('Ошибка отправки сообщения:', error)
			if (axios.isAxiosError(error)) {
				throw new Error(`Ошибка API: ${error.response?.data?.error?.message || error.message}`)
			}
			throw error
		}
	}

	async checkLimits(model: ModelInfo): Promise<boolean> {
		const usage = this.currentUsage.used
		const limit = model.limits.burnRate

		if (usage.perMinute > limit * this.usageLimits.perMinute) {
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
		if (!this.currentUsage.percent) {
			this.currentUsage.percent = { perMinute: 0, perDay: 0 }
		}

		this.currentUsage.remaining.perMinute = this.usageLimits.perMinute - this.currentUsage.used.perMinute

		this.currentUsage.remaining.perDay = this.usageLimits.perDay - this.currentUsage.used.perDay

		this.currentUsage.percent.perMinute = (this.currentUsage.used.perMinute / this.usageLimits.perMinute) * 100

		this.currentUsage.percent.perDay = (this.currentUsage.used.perDay / this.usageLimits.perDay) * 100
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
					topP: 1.0,
				},
				limits: {
					messagesPerMinute: 60,
					tokensPerMinute: 2_000_000,
					burnRate: 0.85,
				},
			},
			{
				id: 'mixtral-8x7b',
				name: 'Mixtral 8x7B',
				provider: 'groq',
				parameters: {
					maxTokens: 16384,
					temperature: 0.6,
					topP: 0.95,
				},
				limits: {
					messagesPerMinute: 45,
					tokensPerMinute: 2_500_000,
					burnRate: 0.78,
				},
			},
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
