<template>
  <div class="model-select">
    <label>🤖 Модель:</label>
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="m in options" :key="m.value" :value="m.value">
        {{ m.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  options: { value: string; label: string }[];  // ← теперь пропс, чтобы брать из стора
}>();

defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();
</script>

<style scoped>
.model-select {
  padding: 12px 16px;
  background-color: #f9f9f9;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.model-select label {
  font-weight: 500;
  color: #333;
}

.model-select select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  background-color: white;
  min-width: 220px;
}

.model-select select:focus {
  outline: none;
  border-color: #42b883;
  box-shadow: 0 0 0 2px rgba(66, 184, 131, 0.2);
}
</style>
