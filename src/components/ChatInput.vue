<template>
  <div class="chat-input">
    <textarea
      ref="textareaRef"
      v-model="input"
      @keydown.ctrl.enter="send"
      @keydown.up.prevent="historyUp"
      @keydown.down.prevent="historyDown"
      :disabled="disabled"
      placeholder="Напишите сообщение... (Ctrl+Enter для отправки)"
      rows="3"
    />
    <button @click="send" :disabled="disabled">
      <span v-if="disabled">⏳ Отправка...</span>
      <span v-else>📤 Отправить</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';

const props = defineProps<{
  disabled: boolean;
}>()

const emit = defineEmits<{
  (e: 'send', message: string): void;
}>()

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// История сообщений
const history: string[] = []
let historyIndex = -1 // -1 значит "новое сообщение"

const send = () => {
  const trimmed = input.value.trim()
  if (!trimmed || props.disabled) return

  emit('send', trimmed)

  // Добавляем в историю, если не дубликат последнего
  if (!history.length || history[history.length - 1] !== trimmed) {
    history.push(trimmed)
  }

  historyIndex = -1 // сброс индекса истории
  input.value = ''

  // автофокус
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

// навигация по истории ↑
const historyUp = () => {
  if (!history.length) return
  if (historyIndex === -1) historyIndex = history.length
  if (historyIndex > 0) historyIndex--
  input.value = history[historyIndex]
  nextTick(() => textareaRef.value?.setSelectionRange(input.value.length, input.value.length))
}

// навигация по истории ↓
const historyDown = () => {
  if (!history.length || historyIndex === -1) return
  if (historyIndex < history.length - 1) {
    historyIndex++
    input.value = history[historyIndex]
  } else {
    historyIndex = -1
    input.value = ''
  }
  nextTick(() => textareaRef.value?.setSelectionRange(input.value.length, input.value.length))
}
</script>

<style scoped>
.chat-input {
  display: flex;
  gap: 12px;
  padding: 16px;
  background-color: white;
  border-top: 1px solid #e0e0e0;
}

textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  resize: none;
  transition: border-color 0.2s;
}

textarea:focus {
  outline: none;
  border-color: #42b883;
}

textarea:disabled {
  background-color: #f5f5f5;
}

button {
  padding: 0 24px;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #33a06f;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style>
