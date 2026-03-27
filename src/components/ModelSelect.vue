<template>
	<div class="model-select p-2 bg-gray-50 border-b border-gray-200 flex flex-col gap-2">
		<!-- Заголовок -->
		<div class="flex justify-between items-center">
			<label class="font-medium text-gray-700">Провайдер и модель:</label>

			<div class="flex items-center gap-3">
				<QRCode />

				<span
					:class="[
						'px-2 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors',
						store.isLoading ? 'bg-yellow-100 text-yellow-800 animate-pulse' : 'bg-green-100 text-green-800',
					]"
				>
					{{ store.isLoading ? '💭 думает…' : '✓' }}
				</span>

				<div class="flex items-center gap-2 ml-auto flex-shrink-0">
					<!-- QR-код кнопка -->
					<button
						v-if="!authStore.isAuthenticated"
						@click="showAuthModal = true"
						class="flex items-center gap-2 px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition md:pr-4"
					>
						<span>👤</span>
						<span class="hidden sm:inline">Войти</span>
					</button>

					<RouterLink
						v-else
						to="/profile"
						class="flex items-center gap-2 hover:bg-gray-100 rounded-full p-2 transition-colors"
					>
						<div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
							{{ authStore.user?.name?.charAt(0).toUpperCase() || '👤' }}
						</div>
						<span class="hidden sm:inline text-sm text-gray-700">{{ authStore.user?.name }}</span>
					</RouterLink>
				</div>
			</div>
		</div>

		<!-- Dropdowns -->
		<div class="flex flex-col sm:flex-row gap-3">
			<!-- ПРОВАЙДЕР -->
			<div class="relative w-full sm:w-48" ref="providerRef">
				<button
					@click="toggleProvider"
					class="w-full px-3 py-2 border rounded-lg bg-white text-sm flex justify-between items-center"
				>
					<span class="truncate">
						{{ currentProviderLabel }}
					</span>
					<span>▾</span>
				</button>

				<div
					v-if="isProviderOpen"
					class="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow max-h-60 overflow-auto"
				>
					<div
						v-for="p in providerList"
						:key="p.key"
						@click="selectProvider(p.key)"
						class="px-3 py-2 cursor-pointer hover:bg-gray-100"
					>
						{{ p.name }}
					</div>
				</div>
			</div>

			<!-- МОДЕЛЬ -->
			<div class="relative flex-1" ref="modelRef">
				<button
					@click="toggleModel"
					class="w-full px-3 py-2 border rounded-lg bg-white text-sm flex justify-between items-center disabled:bg-gray-100"
					:disabled="!options.length"
				>
					<span class="truncate">
						{{ selectedModelLabel }}
					</span>
					<span>▾</span>
				</button>

				<div
					v-if="isModelOpen"
					class="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow max-h-72 overflow-auto"
				>
					<div
						v-for="m in options"
						:key="m.value"
						@click="selectModel(m.value)"
						class="px-3 py-2 cursor-pointer hover:bg-gray-100 flex justify-between items-center"
					>
						<span class="truncate">
							{{ truncate(m.label) }}
						</span>

						<span class="ml-2">
							{{ getModelStatusIcon(m) }}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- ЛИМИТЫ -->
		<div v-if="showLimits" class=" limits mt-2 space-y-1 text-xs">
			<div class="flex justify-between">
				<span>Лимит/мин: {{ limits.perMinute }} / {{ MAX_LIMITS.perMinute }}</span>
				<span>{{ Math.round(perMinutePercent) }}%</span>
			</div>

			<div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
				<div
					class="h-full transition-all"
					:style="{
						width: `${perMinutePercent}%`,
						backgroundColor: getProgressColor(perMinutePercent),
					}"
				/>
			</div>

			<div class="flex justify-between mt-2">
				<span>Лимит/день: {{ limits.perDay }} / {{ MAX_LIMITS.perDay }}</span>
				<span>{{ Math.round(perDayPercent) }}%</span>
			</div>

			<div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
				<div
					class="h-full transition-all"
					:style="{
						width: `${perDayPercent}%`,
						backgroundColor: getProgressColor(perDayPercent),
					}"
				/>
			</div>
		</div>

		<AuthModal v-model:visible="showAuthModal" @login="handleLogin" />
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import QRCode from './QrCode.vue'
import AuthModal from './AuthModal.vue'
import { getProviderLimits } from '@/services/llm'

 

const providerList = [
	{ key: 'groq', name: 'Groq ⚡' },
	{ key: 'openrouter', name: 'OpenRouter 🌐' },
] as const

type ProviderKey = (typeof providerList)[number]['key']

const store = useChatStore()
const authStore = useAuthStore()

// Состояние
const isProviderOpen = ref(false)
const isModelOpen = ref(false)
const showAuthModal = ref(false)
const providerRef = ref<HTMLDivElement | null>(null)
const modelRef = ref<HTMLDivElement | null>(null)

// Выбранный провайдер
const selectedProvider = ref<ProviderKey>(
	store.provider && providerList.some(p => p.key === store.provider) ? (store.provider as ProviderKey) : 'groq',
)

// Расчёты
const currentProviderLabel = computed(() => {
	const provider = providerList.find(p => p.key === selectedProvider.value)
	return provider?.name || 'Выберите провайдера'
})

const options = computed(() => store.availableModels || [])

const selectedModelLabel = computed(() => {
	const model = options.value.find(m => m.value === store.selectedModel)
	return model ? truncate(model.label) : 'Выберите модель'
})

// Методы
function toggleProvider() {
	isProviderOpen.value = !isProviderOpen.value
	isModelOpen.value = false
}

function toggleModel() {
	isModelOpen.value = !isModelOpen.value
	isProviderOpen.value = false
}

function selectProvider(p: ProviderKey) {
	selectedProvider.value = p
	store.changeProvider(p)
	isProviderOpen.value = false
}

function selectModel(model: string) {
	store.selectedModel = model
	isModelOpen.value = false
}

function truncate(text: string, max = 40) {
	return text.length > max ? text.slice(0, max) + '…' : text
}

// Лимиты

const limits = computed(() => {
	const lim = getProviderLimits(selectedProvider.value)
	return {
		perMinute: lim?.perMinute ?? 0,
		perDay: lim?.perDay ?? 0,
	}
})
interface Limits {
	perMinute: number
	perDay: number
}

const MAX_LIMITS = computed<Limits>(() => {
	if (selectedProvider.value === 'groq') {
		return { perMinute: 30, perDay: 1000 }
	}
	if (selectedProvider.value === 'openrouter') {
		return { perMinute: 20, perDay: 50 }
	}
	return { perMinute: 20, perDay: 50 }
})

const showLimits = computed(() => {
	return limits.value.perMinute > 0 || limits.value.perDay > 0
})

const perMinutePercent = computed(() => {
	const max = MAX_LIMITS.value.perMinute
	if (max === 0) return 0
	return Math.min(100, (limits.value.perMinute / max) * 100)
})

const perDayPercent = computed(() => {
	const max = MAX_LIMITS.value.perDay
	if (max === 0) return 0
	return Math.min(100, (limits.value.perDay / max) * 100)
})
function getProgressColor(percent: number) {
	if (percent > 50) return '#34D399'
	if (percent > 20) return '#FBBF24'
	return '#F87171'
}

interface ModelOption {
	value: string
	label?: string
}

function getModelStatusIcon(model: ModelOption): string {
	if (selectedProvider.value === 'openrouter') {
		if (limits.value.perMinute <= 0 || limits.value.perDay <= 0) {
			return '🔴'
		}
	}
	const isAvailable = options.value.some(m => m.value === model.value)
	return isAvailable ? '🟢' : '🔴'
}

// Клик вне выпадающего меню
function handleClickOutside(e: MouseEvent) {
	if (providerRef.value && !providerRef.value.contains(e.target as Node)) {
		isProviderOpen.value = false
	}

	if (modelRef.value && !modelRef.value.contains(e.target as Node)) {
		isModelOpen.value = false
	}
}

// Авторизация
function handleLogin() {
	console.log('Пользователь авторизован')
}

// Жизненный цикл
onMounted(() => {
	document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
.model-select {
	width: 100%;
}
.limits  {
	display: none;
}

/* Анимации */
@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(-4px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

div[role='dropdown'] {
	animation: fadeIn 0.15s ease;
}
</style>
