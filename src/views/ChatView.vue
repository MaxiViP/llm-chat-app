<template>
  <div class="chat-view flex flex-col h-screen bg-gray-50">
    <!-- Header -->
    <div class="header flex justify-between items-center p-4 bg-white border-b shadow-sm">
      <div class="flex items-center gap-3">
        <div v-if="store.isModelsLoading" class="text-gray-500 text-sm">Загрузка моделей...</div>
        <ModelSelect v-else />
        <span
          :class="[
            'px-2 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors',
            store.isLoading
              ? 'bg-yellow-100 text-yellow-800 animate-pulse'
              : 'bg-green-100 text-green-800',
          ]"
        >
          {{ store.isLoading ? '💭 думает…' : '✓ готов' }}
        </span>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto flex flex-col gap-2 p-4">
      <ChatMessage
        v-for="(msg, idx) in displayMessages"
        :key="idx"
        :message="msg"
        :is-new="
          idx === displayMessages.length - 1 &&
          msg.role === 'assistant' &&
          store.isLastMessageStreaming
        "
      />

      <!-- Печатает -->
      <div
        v-if="
          store.isLoading &&
          displayMessages.length &&
          displayMessages[displayMessages.length - 1]?.role !== 'assistant'
        "
        class="flex justify-start animate-slideUp"
      >
        <div class="flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-2xl shadow-sm">
          <div class="flex gap-1">
            <span class="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></span>
            <span class="w-2 h-2 bg-primary-500 rounded-full animate-bounce delay-75"></span>
            <span class="w-2 h-2 bg-primary-500 rounded-full animate-bounce delay-150"></span>
          </div>
          <span class="text-sm text-gray-600">печатает...</span>
        </div>
      </div>

      <!-- Приветствие -->
      <div
        v-if="!displayMessages.length && !store.isLoading"
        class="flex justify-center items-center h-full text-center text-gray-400 animate-fadeIn"
      >
        <div>
          <div class="text-5xl mb-3">💬</div>
          <p class="text-lg font-semibold">Начните диалог с AI ассистентом</p>
          <p class="text-sm mt-1">Напишите сообщение в поле внизу</p>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div ref="inputWrapperRef" class="flex-shrink-0 border-t bg-white shadow-lg">
      <ChatInput ref="chatInputRef" :disabled="store.isLoading" @send="handleSend" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import ModelSelect from '@/components/ModelSelect.vue'

const store = useChatStore()
const messagesContainer = ref<HTMLElement | null>(null)
const inputWrapperRef = ref<HTMLElement | null>(null)

const displayMessages = computed(() => store.messages.filter((m) => m.role !== 'system'))

const handleSend = (msg: string) => store.sendMessage(msg)

const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
  if (!messagesContainer.value) return
  nextTick(() => {
    requestAnimationFrame(() =>
      messagesContainer.value?.scrollTo({ top: messagesContainer.value.scrollHeight, behavior }),
    )
  })
}

watch(
  () => store.isLoading,
  (isLoading) => {
    if (isLoading) {
      const interval = setInterval(() => scrollToBottom('auto'), 100)
      onUnmounted(() => clearInterval(interval))
    } else {
      scrollToBottom('smooth')
    }
  },
)
watch(
  () => store.messages.length,
  () => scrollToBottom('smooth'),
)
watch(
  () => store.messages[store.messages.length - 1]?.content,
  () => store.isLoading && scrollToBottom('auto'),
)

onMounted(() => scrollToBottom())
</script>

<style scoped>
.header {
  background-color: rgb(17 24 39 / var(--tw-bg-opacity, 1));
}
/* .chat-view {
  background-color: rgb(11 1 10 / var(--tw-bg-opacity, 1));
} */
/* Анимации */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out forwards;
}
.animate-fadeIn {
  animation: fadeIn 0.5s ease-out forwards;
}
.animate-bounce {
  animation: bounce 1.4s infinite ease-in-out both;
}
.delay-75 {
  animation-delay: 0.1s;
}
.delay-150 {
  animation-delay: 0.2s;
}

/* Скроллбар */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb {
  background: #9ca3af;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
