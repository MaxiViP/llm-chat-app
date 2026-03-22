<template>
  <div class="qr-code-compact relative">
    <button
      @click="openModal"
      class="flex items-center gap-1 px-2 py-1 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg transition-all duration-200 text-sm"
      title="Показать QR-код для телефона"
    >
      <span class="text-base">📱</span>
      <span class="hidden sm:inline">QR</span>
    </button>

    <Teleport to="body">
      <div
        v-if="showQR"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn"
        @click="closeQR"
      >
        <div
          class="bg-white rounded-2xl p-6 shadow-2xl max-w-sm mx-4 animate-scaleIn"
          @click.stop
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-900">QR-код для телефона</h3>
            <button @click="closeQR" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex justify-center mb-4">
            <canvas ref="qrCanvas" class="rounded-lg shadow-md"></canvas>
          </div>
          <div class="text-center space-y-2">
            <p class="text-sm text-gray-600 break-all">{{ networkUrl }}</p>
            <button @click="copyToClipboard" class="text-sm text-primary-600 hover:text-primary-700 font-medium">
              📋 Скопировать ссылку
            </button>
          </div>
          <div class="mt-4 pt-4 border-t border-gray-200">
            <div class="text-xs text-gray-500 text-center space-y-1">
              <p>1. Подключите телефон к той же Wi-Fi сети</p>
              <p>2. Отсканируйте QR-код камерой телефона</p>
              <p>3. Или введите адрес вручную</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import QRCode from 'qrcode'

const showQR = ref(false)
const qrCanvas = ref<HTMLCanvasElement>()
const networkUrl = ref(import.meta.env.VITE_NETWORK_URL || '')

const openModal = () => {
  showQR.value = true
}
const closeQR = () => {
  showQR.value = false
}

watch(showQR, async (visible) => {
  if (visible) {
    await nextTick()
    if (qrCanvas.value && networkUrl.value) {
      try {
        await QRCode.toCanvas(qrCanvas.value, networkUrl.value, {
          width: 200,
          margin: 2,
          color: { dark: '#2563eb', light: '#ffffff' }
        })
      } catch (error) {
        console.error('Ошибка генерации QR-кода:', error)
      }
    }
  }
})

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(networkUrl.value)
    alert('Ссылка скопирована!')
  } catch (error) {
    console.error('Ошибка копирования:', error)
  }
}
</script>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
.animate-scaleIn {
  animation: scaleIn 0.2s ease-out;
}
</style>
