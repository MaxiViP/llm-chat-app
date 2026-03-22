<template>
  <div class="model-select p-1 bg-gray-50 border-b border-gray-200 flex flex-col gap-2">
    <div class="flex justify-between items-center">
      <label class="font-medium text-gray-700">Провайдер и модель:</label>

      <div class="flex items-center gap-3">
        <!-- QR-код кнопка -->
        <QRCode />

        <!-- Статус ассистента -->
        <span
          :class="[
            'px-2 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors',
            store.isLoading
              ? 'bg-yellow-100 text-yellow-800 animate-pulse'
              : 'bg-green-100 text-green-800',
          ]"
        >
          {{ store.isLoading ? '💭 думает…' : '✓' }}
        </span>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-3">
      <!-- Провайдер -->
      <div class="relative w-full sm:w-48">
        <select
          v-model="selectedProvider"
          @change="onProviderChange"
          class="w-full px-3 py-2 border rounded-lg bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 appearance-none cursor-pointer transition"
        >
          <option v-for="p in providerList" :key="p.key" :value="p.key">
            {{ p.name }}
          </option>
        </select>
        <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"
          >▾</span
        >
      </div>

      <!-- Модель -->
      <div class="relative flex-1">
        <select
          v-model="modelValue"
          :disabled="!options.length"
          class="w-full px-3 py-2 border rounded-lg bg-white disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 appearance-none cursor-pointer transition"
        >
          <option v-for="m in options" :key="m.value" :value="m.value">
            {{ getModelStatusIcon(m) }} {{ m.label }}
          </option>
        </select>
        <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"
          >▾</span
        >
      </div>
    </div>

    <!-- 🔹 Лимиты OpenRouter -->
    <div v-if="showLimits" class="mt-2 space-y-1 text-xs">
      <div class="flex justify-between">
        <span>Лимит запросов/мин: {{ limits.perMinute }} / {{ MAX_LIMITS.perMinute }}</span>
        <span class="text-gray-500">{{ Math.round(perMinutePercent) }}%</span>
      </div>
      <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :style="{
            width: `${perMinutePercent}%`,
            backgroundColor: getProgressColor(perMinutePercent),
          }"
        ></div>
      </div>

      <div class="flex justify-between mt-2">
        <span>Лимит запросов/день: {{ limits.perDay }} / {{ MAX_LIMITS.perDay }}</span>
        <span class="text-gray-500">{{ Math.round(perDayPercent) }}%</span>
      </div>
      <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :style="{
            width: `${perDayPercent}%`,
            backgroundColor: getProgressColor(perDayPercent),
          }"
        ></div>
      </div>
    </div>

    <!-- Модальное окно авторизации -->
    <AuthModal v-model:visible="showAuthModal" @login="handleLogin" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

import { useChatStore } from '@/stores/chat'

import { getProviderLimits } from '@/services/llm'
import QRCode from './QrCode.vue'
import AuthModal from './AuthModal.vue'

type ProviderKey = 'groq' | 'openrouter'
const store = useChatStore()

const showAuthModal = ref(false)

const modelValue = computed({
  get: () => store.selectedModel,
  set: (v: string) => (store.selectedModel = v),
})

const selectedProvider = ref<ProviderKey>(store.provider)
const providerList = [
  { key: 'groq', name: 'Groq ⚡' },
  { key: 'openrouter', name: 'OpenRouter 🌐' },
]

const options = computed(() => store.availableModels)

// 🔹 Лимиты
const limits = ref({ perMinute: Infinity, perDay: Infinity })
const MAX_LIMITS = { perMinute: 20, perDay: 50 } // можно изменить под реальные значения
const showLimits = computed(() => selectedProvider.value === 'openrouter')

// 🔹 Функции для прогресс-бара
const perMinutePercent = computed(() =>
  Math.max(0, Math.min(100, (limits.value.perMinute / MAX_LIMITS.perMinute) * 100)),
)
const perDayPercent = computed(() =>
  Math.max(0, Math.min(100, (limits.value.perDay / MAX_LIMITS.perDay) * 100)),
)

// Цвета прогресса: зелёный >50%, жёлтый 20–50%, красный <20%
function getProgressColor(percent: number) {
  if (percent > 50) return '#34D399' // зелёный
  if (percent > 20) return '#FBBF24' // жёлтый
  return '#F87171' // красный
}

// Обновляем лимиты
function updateLimits() {
  limits.value = getProviderLimits(selectedProvider.value)
}

// Автообновление каждые 10 секунд
let intervalId: number | undefined
onMounted(() => {
  updateLimits()
  intervalId = window.setInterval(() => {
    if (selectedProvider.value === 'openrouter') {
      updateLimits()
    }
  }, 10000)
})
onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})

function onProviderChange() {
  store.changeProvider(selectedProvider.value)
  updateLimits()
}

watch(
  () => store.provider,
  (val) => {
    selectedProvider.value = val
  },
)

function isModelActive(model: { value: string; label: string }) {
  return store.availableModels.some((m) => m.value === model.value)
}

function getModelStatusIcon(model: { value: string; label: string }) {
  if (selectedProvider.value === 'openrouter') {
    if (limits.value.perMinute <= 0 || limits.value.perDay <= 0) return '🔴'
  }
  return isModelActive(model) ? '🟢' : '🔴'
}

const handleLogin = () => {
  console.log('Пользователь авторизован')
  // Можно добавить логику после входа
}
</script>

<style scoped>
/* Полоски прогресса уже встроены через inline style, кастомного CSS почти нет */
</style>
