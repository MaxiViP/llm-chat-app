<template>
  <div class="chat-input flex-shrink-0 bg-white border-t border-gray-200 shadow-lg p-3 sm:p-4">
    <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
      <textarea
        ref="textareaRef"
        v-model="input"
        @keydown.enter.ctrl.prevent="send"
        @keydown.enter.prevent="send"
        @keydown.up.prevent="historyUp"
        @keydown.down.prevent="historyDown"
        :disabled="disabled"
        :placeholder="placeholderText"
        rows="2"
        class="flex-1 px-3 py-2 sm:py-3 border border-gray-300 rounded-lg
               focus:outline-none focus:ring-2 focus:ring-primary-500
               disabled:bg-gray-100 disabled:cursor-not-allowed
               resize-none text-sm sm:text-base transition-all duration-200"
      />
      <button
        @click="send"
        :disabled="disabled"
        class="px-4 sm:px-6 py-2 sm:py-3 bg-primary-600 text-white rounded-lg
               hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500
               disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
      >
        {{ disabled ? 'Отправка...' : 'Отправить' }}
      </button>
    </div>
    <div class="mt-2 text-xs text-gray-500 flex justify-between items-center">
      <span class="hidden sm:inline">Ctrl+Enter — отправить</span>
      <span class="sm:hidden">⌨️ Enter — отправить</span>
      <span v-if="input.length > 0" class="text-primary-600">{{ input.length }} симв.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps<{ disabled: boolean }>()
const emit = defineEmits<{ (e: 'send', message: string): void }>()

const input = ref<string>('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// Определение типа для window
const isWindowDefined = typeof window !== 'undefined'

const placeholderText = computed(() => {
  if (isWindowDefined) {
    return window.innerWidth < 640
      ? 'Сообщение... (Enter для отправки)'
      : 'Напишите сообщение... (Ctrl+Enter для отправки)'
  }
  return 'Напишите сообщение... (Ctrl+Enter для отправки)'
})

// История сообщений
const history: string[] = []
let historyIndex: number = -1
let tempInput: string = ''  // сохраняем текущее сообщение перед навигацией по истории

const send = (): void => {
  const trimmed = input.value.trim()
  if (!trimmed || props.disabled) return

  emit('send', trimmed)

  // Сохраняем в историю, если новое сообщение
  if (!history.length || history[history.length - 1] !== trimmed) {
    history.push(trimmed)
  }
  historyIndex = -1
  tempInput = ''
  input.value = ''

  // Всегда фокусируем поле после отправки
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
    }
  })
}

// Навигация по истории вверх
const historyUp = (): void => {
  if (!history.length) return

  if (historyIndex === -1) {
    historyIndex = history.length - 1
    tempInput = input.value   // сохраняем текущее сообщение
  } else if (historyIndex > 0) {
    historyIndex--
  }

  const historyValue = history[historyIndex]
  if (historyValue !== undefined) {
    input.value = historyValue
    nextTick(() => {
      if (textareaRef.value) {
        const length = input.value.length
        textareaRef.value.setSelectionRange(length, length)
      }
    })
  }
}

// Навигация по истории вниз
const historyDown = (): void => {
  if (!history.length || historyIndex === -1) return

  if (historyIndex < history.length - 1) {
    historyIndex++
    const historyValue = history[historyIndex]
    if (historyValue !== undefined) {
      input.value = historyValue
    }
  } else {
    historyIndex = -1
    input.value = tempInput   // возвращаем то, что было перед историей
  }

  nextTick(() => {
    if (textareaRef.value) {
      const length = input.value.length
      textareaRef.value.setSelectionRange(length, length)
    }
  })
}

// Обновление placeholder при изменении размера окна
const updatePlaceholder = (): void => {
  // Просто вызываем перерасчет computed свойства
  // placeholderText обновится автоматически
}

onMounted(() => {
  if (isWindowDefined) {
    window.addEventListener('resize', updatePlaceholder)
  }
})

onUnmounted(() => {
  if (isWindowDefined) {
    window.removeEventListener('resize', updatePlaceholder)
  }
})
</script>

<style scoped>
/* Анимация спиннера */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Темная тема */
@media (prefers-color-scheme: dark) {
  .chat-input {
    background-color: rgb(17 24 39);
    border-color: rgb(55 65 81);
  }
}
</style>
