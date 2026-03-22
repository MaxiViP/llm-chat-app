<template>
  <div :class="['message', message.role]">
    <div class="avatar">
      <span v-if="message.role === 'user'">👤</span>
      <span v-else>🤖</span>
    </div>
    <div class="content">
      {{ message.content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Message } from '@/services/llm'

defineProps<{
  message: Message
}>()
</script>

<style scoped>
.message {
  display: flex;
  background-color: aquamarine;
  gap: 12px;
  padding: 12px;
  margin-bottom: 16px;
  border-radius: 12px;
  animation: fadeIn 0.3s ease;
}

.message.user {
  background-color: #e3f2fd;
  justify-content: flex-end;
}

.message.assistant {
  background-color: #f5f5f5;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.content {
  background-color:#dedfe0;
  flex: 1;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
