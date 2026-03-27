/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineStore } from 'pinia'
import { ref, onMounted, watch } from 'vue'
import { sendMessageStream, setProvider, type Message, getAvailableModels } from '@/services/llm'

interface ModelOption {
	value: string
	label: string
}

type ProviderKey = 'groq' | 'openrouter'

export const useChatStore = defineStore('chat', () => {
	/* ---------- Константы & реактивные переменные ---------- */
	const LOCAL_STORAGE_KEY = 'chat_messages'

	const messages = ref<Message[]>([
		{
			role: 'system',
			content: 'Ты полезный ассистент. Отвечай кратко и по делу на русском языке.',
		},
	])

	const isLoading = ref(false)
	const isModelsLoading = ref(true)
	const selectedModel = ref<string>('smart')
	const error = ref<string | null>(null)

	const availableModels = ref<ModelOption[]>([])
	const provider = ref<ProviderKey>('groq')

	const currentFallbackAttempt = ref(0)
	const isLastMessageStreaming = ref(false)

	const userMessageCount = ref(0)

	function pickRandomModel(): { model: string; provider: ProviderKey } {
		const allModels = [
			...cachedRealModels.value.groq.map(m => ({ ...m, provider: 'groq' as const })),
			...cachedRealModels.value.openrouter.map(m => ({ ...m, provider: 'openrouter' as const })),
		]

		if (!allModels.length) {
			return { model: selectedModel.value, provider: provider.value }
		}

		// ✅ FIX: добавлен !
		const random = allModels[Math.floor(Math.random() * allModels.length)]!

		return {
			model: random.value,
			provider: random.provider,
		}
	}
	/* ---------- Кеширование реальных моделей ---------- */
	const cachedRealModels = ref<Record<ProviderKey, ModelOption[]>>({
		groq: [],
		openrouter: [],
	})

	/* ---------- Монтирование & подписки ---------- */
	onMounted(() => {
		// 1. Попытка загрузить сохранённые сообщения
		const savedMessages = localStorage.getItem(LOCAL_STORAGE_KEY)
		if (savedMessages) {
			try {
				messages.value = JSON.parse(savedMessages)
			} catch (_) {
				console.error('Не удалось распарсить сохраненные сообщения')
			}
		}

		// 2. Загрузка списка моделей
		loadAvailableModels()

		// 3. Установка провайдера (по умолчанию groq)
		setProvider(provider.value)
	})

	watch(
		messages,
		val => {
			localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(val))
		},
		{ deep: true },
	)

	/* ---------- Загрузка моделей ---------- */
	async function loadAvailableModels() {
		isModelsLoading.value = true

		// Базовый список
		availableModels.value = [
			{ value: 'fast', label: '⚡ Быстрая' },
			{ value: 'smart', label: '🧠 Умная' },
			{ value: 'code', label: '💻 Код' },
			{ value: 'manual', label: '🛠 Своя модель' },
		]

		for (const p of ['groq', 'openrouter'] as ProviderKey[]) {
			try {
				const realModels = await getAvailableModels(p)
				if (realModels.length) {
					cachedRealModels.value[p] = realModels
					const existingIds = new Set(availableModels.value.map(m => m.value))
					for (const model of realModels) {
						if (!existingIds.has(model.value)) {
							availableModels.value.push({
								value: model.value,
								label: `${model.label}`,
							})
						}
					}
				}
			} catch (_) {
				console.warn(`Не удалось загрузить модели для ${p}`)
			}
		}

		if (!selectedModel.value) {
			selectedModel.value = 'smart'
		}
		isModelsLoading.value = false
	}

	/* ---------- Переключение провайдера ---------- */
	async function changeProvider(newProvider: ProviderKey) {
		if (provider.value === newProvider) return
		provider.value = newProvider
		setProvider(newProvider)
		await loadAvailableModels()
	}

	/* ---------- Работа с сообщениями ---------- */
	function addUserMessage(content: string) {
		messages.value.push({ role: 'user', content })
	}

	function createAssistantMessage(): Message {
		const msg: Message = { role: 'assistant', content: '' }
		messages.value.push(msg)
		return msg
	}

	/* ---------- Проверка валидности ответа ---------- */
	function isResponseValid(content: string): boolean {
		if (!content || content.trim().length < 10) return false

		const trimmedContent = content.trim().toLowerCase()
		const invalidResponses = new Set(['...', '😊', '👍', '✅', '❌', 'да', 'нет', 'ok', 'хорошо', 'плохо', 'норм'])

		return !invalidResponses.has(trimmedContent)
	}

	/* ---------- Список резервных моделей ---------- */
	function getFallbackModels(): Array<{ provider: ProviderKey; model: string; name: string }> {
		const fallbackList = [
			...cachedRealModels.value.groq.map(model => ({
				provider: 'groq' as ProviderKey,
				model: model.value,
				name: `Groq: ${model.label}`,
			})),
			...cachedRealModels.value.openrouter.map(model => ({
				provider: 'openrouter' as ProviderKey,
				model: model.value,
				name: `OpenRouter: ${model.label}`,
			})),
		]

		if (fallbackList.length === 0) {
			return [
				{ provider: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq Llama 70B (резерв)' },
				{ provider: 'groq', model: 'llama-3.1-8b-instant', name: 'Groq Llama 8B (резерв)' },
				{
					provider: 'openrouter',
					model: 'google/gemini-2.0-flash-exp:free',
					name: 'OpenRouter Gemini (резерв)',
				},
			]
		}

		return fallbackList
	}

	/* ---------- Обрезка истории по токенам ---------- */
	function trimHistory(messagesList: Message[], maxTokens = 2500): Message[] {
		const systemMessages = messagesList.filter(m => m.role === 'system')
		const otherMessages = messagesList.filter(m => m.role !== 'system')

		let totalChars = 0
		const trimmedMessages = [...systemMessages]

		for (let i = otherMessages.length - 1; i >= 0; i--) {
			const msg = otherMessages[i]
			if (!msg) continue // Проверка на undefined

			if (totalChars + msg.content.length <= maxTokens * 4) {
				trimmedMessages.unshift(msg)
				totalChars += msg.content.length
			} else {
				// Добавляем системное предупреждение, если обрезаем
				if (!trimmedMessages.some(m => m.role === 'system' && m.content.includes('обрезана'))) {
					trimmedMessages.unshift({
						role: 'system',
						content: '⚠️ Часть истории была обрезана из‑за ограничения по токенам.',
					})
				}
				break
			}
		}

		console.log(
			`📊 История обрезана: ${otherMessages.length} → ${
				trimmedMessages.length - systemMessages.length
			} сообщений, ${totalChars} символов`,
		)
		return trimmedMessages
	}

	/* ---------- Отправка с fallback‑логикой ---------- */
	async function tryGetResponseWithFallback(
		historyMessages: Message[],
		onChunk: (chunk: string) => void,
	): Promise<boolean> {
		const fallbackModels = [
			{
				provider: provider.value,
				model: selectedModel.value,
				name: `Selected: ${selectedModel.value}`,
			},
			...getFallbackModels(),
		]
		let lastError: any = null

		console.log(`📋 Всего моделей для fallback: ${fallbackModels.length}`)

		for (let i = 0; i < fallbackModels.length; i++) {
			const item = fallbackModels[i]
			if (!item) continue // Проверка на undefined

			currentFallbackAttempt.value = i + 1

			try {
				console.log(`🚀 Попытка ${i + 1}/${fallbackModels.length}: ${item.name}`)
				setProvider(item.provider)

				let response = ''

				await sendMessageStream(historyMessages, item.model, chunk => {
					response += chunk
					onChunk(chunk)
				})

				if (isResponseValid(response)) {
					console.log(`✅ Успешный ответ от ${item.name}, длина: ${response.length}`)
					return true
				} else {
					console.warn(`⚠️ Ответ от ${item.name} слишком короткий, пробуем дальше…`)
					onChunk('')
					lastError = new Error('Пустой или слишком короткий ответ')
				}
			} catch (err: unknown) {
				const errorMsg = err instanceof Error ? err.message : String(err)

				if (errorMsg.includes('429') || errorMsg.includes('rate_limit')) {
					console.warn(`⏳ Лимит ${item.name}, пробуем следующую…`)
				} else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
					console.warn(`❓ Модель ${item.name} не найдена, пробуем следующую…`)
				} else if (errorMsg.includes('413') || errorMsg.includes('too large')) {
					console.warn(`📦 ${item.name}: запрос слишком большой, пробуем следующую…`)
				} else if (errorMsg.includes('402') || errorMsg.includes('tokens')) {
					console.warn(`💰 ${item.name}: лимит токенов, пробуем следующую…`)
				} else {
					console.warn(`❌ Ошибка при запросе к ${item.name}:`, errorMsg.slice(0, 100))
				}

				lastError = err
				onChunk('')
				await new Promise(r => setTimeout(r, 500))
			}
		}

		console.error(`❌ Все ${fallbackModels.length} моделей не дали ответ`)
		throw lastError ?? new Error('Ни одна модель не смогла ответить')
	}

	/* ---------- Вспомогательный fallback‑текст ---------- */
	function getFallbackResponse(userInput: string): string {
		const responses = [
			`Извините, в данный момент сервис временно недоступен. Попробуйте позже. Ваш запрос: "${userInput.slice(0, 50)}${userInput.length > 50 ? '...' : ''}"`,
			`К сожалению, не удалось обработать ваш запрос. Пожалуйста, попробуйте переформулировать вопрос или подождите немного.`,
			`Технические неполадки. Наши инженеры уже работают над исправлением. Приносим извинения за неудобства.`,
			`Не могу ответить на ваш вопрос прямо сейчас. Пожалуйста, попробуйте позже или задайте другой вопрос.`,
		]
		return responses[Math.floor(Math.random() * responses.length)] || ''
	}

	/* ---------- Основная функция отправки сообщения ---------- */
	async function sendMessage(userInput: string) {
		if (!userInput.trim() || isLoading.value || !selectedModel.value) return

		addUserMessage(userInput)

		// 👇 считаем сообщения
		userMessageCount.value++

		// 👇 каждые 3 сообщения меняем модель
		if (userMessageCount.value % 3 === 0) {
			const random = pickRandomModel()

			selectedModel.value = random.model
			provider.value = random.provider
			setProvider(random.provider)

			console.log('🔄 Модель:', random.model, 'провайдер:', random.provider)
		}
		const assistantMessage = createAssistantMessage()

		isLoading.value = true
		isLastMessageStreaming.value = true
		error.value = null
		currentFallbackAttempt.value = 0

		try {
			// 📦 собираем историю
			const systemMsg = messages.value.find(m => m.role === 'system')
			const historyWithoutSystem = messages.value.filter(m => m.role !== 'system')
			const fullHistory = systemMsg ? [systemMsg, ...historyWithoutSystem] : historyWithoutSystem

			// ✂️ обрезаем
			const trimmedHistory = trimHistory(fullHistory)

			let fullResponse = ''

			await tryGetResponseWithFallback(trimmedHistory, chunk => {
				fullResponse += chunk
				assistantMessage.content = fullResponse
			})

			console.log('✅ Ответ получен')
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : String(err)
			console.error('❌ Ошибка при запросе:', errMsg)

			error.value = errMsg || 'Не удалось получить ответ'

			if (errMsg.includes('402') || errMsg.includes('tokens')) {
				assistantMessage.content =
					'⚠️ **Превышен лимит токенов**\n\nДиалог слишком длинный для бесплатных моделей. Попробуйте:\n• Начать новый чат\n• Задать более короткий вопрос\n\nВаш вопрос: "' +
					userInput.slice(0, 100) +
					(userInput.length > 100 ? '...' : '') +
					'"'
			} else if (errMsg.includes('429') || errMsg.includes('rate_limit')) {
				assistantMessage.content = '⏳ **Лимит запросов превышен**\n\nПодождите немного и попробуйте снова.'
			} else {
				assistantMessage.content = getFallbackResponse(userInput)
			}
		} finally {
			isLoading.value = false
			isLastMessageStreaming.value = false
		}
	}

	/* ---------- Тестирование конкретной модели ---------- */
	async function testModel(testProvider: ProviderKey, model: string): Promise<boolean> {
		try {
			setProvider(testProvider)
			let response = ''

			await sendMessageStream([{ role: 'user', content: 'Ответь "тест"' }], model, chunk => {
				response += chunk
			})

			return response.trim().length > 0
		} catch (_) {
			return false
		}
	}

	/* ---------- Очистка чата ---------- */
	function clearChat() {
		messages.value = [
			{
				role: 'system',
				content: 'Ты полезный ассистент. Отвечай кратко и по делу на русском языке.',
			},
		]
		localStorage.removeItem(LOCAL_STORAGE_KEY)
		error.value = null
	}

	/* ---------- Экспорт store ---------- */
	return {
		messages,
		isLoading,
		isModelsLoading,
		selectedModel,
		error,
		availableModels,
		provider,
		currentFallbackAttempt,
		isLastMessageStreaming,

		sendMessage,
		clearChat,
		changeProvider,
		loadAvailableModels,
		testModel,

		// Добавлено для тестирования
		trimHistory,
		isResponseValid,
		getFallbackModels,
		tryGetResponseWithFallback,
		cachedRealModels, // только для чтения, но в тестах мы можем его изменять
	}
})
