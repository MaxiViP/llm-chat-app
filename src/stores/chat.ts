import { defineStore } from 'pinia'
import { ref, onMounted, watch } from 'vue'
import { sendMessageStream, type Message, getAvailableModels } from '@/services/llm'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
export const currentChatId = ref<string | null>(null)

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

	// Новый важный state
	const currentChatId = ref<string | null>(null)

	/* ---------- Кеширование реальных моделей ---------- */
	const cachedRealModels = ref<Record<ProviderKey, ModelOption[]>>({
		groq: [],
		openrouter: [],
	})

	/* ---------- Монтирование ---------- */
	onMounted(async () => {
		// Загружаем или создаём чат
		await loadOrCreateChat()

		// Загружаем сохранённые сообщения (опционально)
		const savedMessages = localStorage.getItem(LOCAL_STORAGE_KEY)
		if (savedMessages) {
			try {
				messages.value = JSON.parse(savedMessages)
			} catch (_) {
				console.error('Не удалось загрузить сохранённые сообщения')
			}
		}

		loadAvailableModels()
	})

	watch(
		messages,
		val => {
			localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(val))
		},
		{ deep: true },
	)

	/* ---------- Создание / загрузка чата ---------- */
	async function createNewChat() {
		const authStore = useAuthStore()
		if (!authStore.isAuthenticated) return null

		try {
			const { data } = await api.post('/chats', { title: 'Новый чат' })
			currentChatId.value = data.id
			return data.id
		} catch (err) {
			console.error('Ошибка создания чата:', err)
			return null
		}
	}

	async function loadOrCreateChat() {
		if (currentChatId.value) return currentChatId.value

		const chatId = await createNewChat()
		if (chatId) {
			currentChatId.value = chatId
		}
		return chatId
	}

	function setCurrentChatId(id: string) {
		currentChatId.value = id
	}

	/* ---------- Загрузка моделей ---------- */
	async function loadAvailableModels() {
		isModelsLoading.value = true

		availableModels.value = [
			{ value: 'fast', label: '⚡ Быстрая' },
			{ value: 'smart', label: '🧠 Умная' },
			{ value: 'code', label: '💻 Код' },
			{ value: 'manual', label: '🛠 Своя модель' },
		]

		// Можно оставить попытку загрузки реальных моделей, если хочешь
		isModelsLoading.value = false
	}

	/* ---------- Отправка сообщения (главная функция) ---------- */
	async function sendMessage(userInput: string) {
		if (!userInput.trim() || isLoading.value || !selectedModel.value) return

		// Убеждаемся, что чат существует
		if (!currentChatId.value) {
			await loadOrCreateChat()
			if (!currentChatId.value) {
				error.value = 'Не удалось создать чат'
				return
			}
		}

		addUserMessage(userInput)
		userMessageCount.value++

		const assistantMessage = createAssistantMessage()

		isLoading.value = true
		isLastMessageStreaming.value = true
		error.value = null

		try {
			const systemMsg = messages.value.find(m => m.role === 'system')
			const historyWithoutSystem = messages.value.filter(m => m.role !== 'system')
			const fullHistory = systemMsg ? [systemMsg, ...historyWithoutSystem] : historyWithoutSystem

			const trimmedHistory = trimHistory(fullHistory)

			let fullResponse = ''

			await sendMessageStream(trimmedHistory, selectedModel.value, chunk => {
				fullResponse += chunk
				assistantMessage.content = fullResponse
			})

			console.log('✅ Ответ успешно получен')
		} catch (err: any) {
			console.error('Ошибка при запросе:', err)
			error.value = err.message || 'Не удалось получить ответ'

			if (err.message.includes('Недостаточно средств')) {
				assistantMessage.content = '⚠️ Недостаточно средств на балансе. Пополните баланс в профиле.'
			} else {
				assistantMessage.content = '❌ Произошла ошибка. Попробуйте позже.'
			}
		} finally {
			isLoading.value = false
			isLastMessageStreaming.value = false
		}
	}

	// Остальные функции (addUserMessage, createAssistantMessage, trimHistory и т.д.) оставь как были

	function addUserMessage(content: string) {
		messages.value.push({ role: 'user', content })
	}

	function createAssistantMessage(): Message {
		const msg: Message = { role: 'assistant', content: '' }
		messages.value.push(msg)
		return msg
	}

	function trimHistory(messagesList: Message[], maxTokens = 2500): Message[] {
		// ... оставь свою реализацию
		return messagesList // временно упрощённо
	}

	/* ---------- Экспорт ---------- */
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
		currentChatId,

		sendMessage,
		clearChat: () => {
			/* твоя реализация */
		},
		loadAvailableModels,
		loadOrCreateChat,
		setCurrentChatId,
	}
})
