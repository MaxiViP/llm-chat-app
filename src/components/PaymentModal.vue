<!-- components/PaymentModal.vue -->
<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="close">
      <div class="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" @click.stop>
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Пополнение баланса</h2>
          <button @click="close" class="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form @submit.prevent="submit">
          <input
            v-model="amount"
            type="number"
            placeholder="Сумма"
            required
            class="w-full px-3 py-2 border rounded-lg mb-4"
          />
          <button
            type="submit"
            class="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition"
          >
            Оплатить
          </button>
        </form>
        <p class="text-xs text-gray-500 mt-3 text-center">Демо-режим: оплата не производится</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ (e: 'success', amount: number): void }>()

const amount = ref(0)

const close = () => {
  visible.value = false
  amount.value = 0
}

const submit = () => {
  if (amount.value > 0) {
    emit('success', amount.value)
    close()
  }
}
</script>
