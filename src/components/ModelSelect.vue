<template>
  <div class="model-select">
    <label>Провайдер и модель:</label>

    <div class="select-group">
      <!-- Провайдер -->
      <select v-model="selectedProvider" @change="onProviderChange">
        <option v-for="p in providerList" :key="p.key" :value="p.key">
          {{ p.name }}
        </option>
      </select>

      <!-- Модель -->
      <select v-model="modelValue" :disabled="!options.length">
  <option
    v-for="m in options"
    :key="m.value"
    :value="m.value"
  >
    {{ isModelActive(m) ? '🟢' : '🔴' }} {{ m.label }}
  </option>
</select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'

type ProviderKey = 'groq' | 'openrouter'
const store = useChatStore()

/* -------------------------------------------------------------------------- */
/*  MODEL (v-model)                                                           */
/* -------------------------------------------------------------------------- */
const modelValue = computed({
  get: () => store.selectedModel,
  set: (v: string) => (store.selectedModel = v),
})

/* -------------------------------------------------------------------------- */
/*  PROVIDER                                                                 */
const selectedProvider = ref<ProviderKey>(store.provider)
const providerList = [
  { key: 'groq', name: 'Groq ⚡' },
  { key: 'openrouter', name: 'OpenRouter 🌐' },
]

/* -------------------------------------------------------------------------- */
/*  MODELS                                                                   */
const options = computed(() => store.availableModels)

/* -------------------------------------------------------------------------- */
/*  EVENTS                                                                   */
function onProviderChange() {
  store.changeProvider(selectedProvider.value)
}

/* синхронизация внешнего выбора */
watch(
  () => store.provider,
  (val) => {
    selectedProvider.value = val
  }
)

/* -------------------------------------------------------------------------- */
/*  UTILS                                                                    */
function isModelActive(model: { value: string; label: string }) {
  // активная модель — есть в списке доступных моделей
  return store.availableModels.some((m) => m.value === model.value)
}
</script>

<style scoped>
.model-select {
  padding: 12px 16px;
  background: #f9f9f9;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.select-group {
  display: flex;
  gap: 12px;
}

select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  min-width: 160px;
  transition: all 0.2s;
}

select:focus {
  outline: none;
  border-color: #42b883;
  box-shadow: 0 0 0 2px rgba(66, 184, 131, 0.2);
}

/* -------------------------------------------------------------------------- */
/*  Индикатор статуса моделей                                                  */
.status-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-left: 6px;
}

.status-indicator.active {
  background-color: #4caf50; /* зелёный */
}

.status-indicator.inactive {
  background-color: #f44336; /* красный */
}
</style>
