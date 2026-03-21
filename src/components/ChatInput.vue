<template>
  <div class="chat-input">
    <textarea
      ref="textareaRef"
      v-model="input"
      @keydown.ctrl.enter="send"
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
}>();

const emit = defineEmits<{
  (e: 'send', message: string): void;
}>();

const input = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const send = () => {
  if (!input.value.trim() || props.disabled) return;
  emit('send', input.value);
  input.value = '';

  // Автофокус после отправки
  nextTick(() => {
    textareaRef.value?.focus();
  });
};
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
