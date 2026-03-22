<template>
  <div
    :class="[
      'flex gap-2 p-1 sm:p-2 mb-1 sm:mb-2 transition-all duration-300 animate-slideUp w-full',
      message.role === 'user' ? 'flex-row-reverse justify-start' : 'flex-row justify-start',
    ]"
  >
    <!-- Аватар -->
    <div
      :class="[
        'w-6 h-6 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-xl flex-shrink-0 self-end mt-auto',
        message.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-600',
      ]"
    >
      <span v-if="message.role === 'user'">👤</span>
      <span v-else>🤖</span>
    </div>

    <!-- Контент -->
    <div
      class="flex-1 max-w-[75%] break-words whitespace-pre-wrap text-sm sm:text-base leading-relaxed px-3 py-2"
      :class="[
        message.role === 'user'
          ? 'text-left text-gray-800 rounded-tl-xl rounded-tr-xl rounded-bl-xl rounded-br-[4px] bg-primary-100'
          : 'text-left text-gray-700 rounded-tl-xl rounded-tr-xl rounded-bl-[4px] rounded-br-xl bg-gray-100',
      ]"
    >
      <!-- Текст сообщения -->
      <template v-if="message.role === 'assistant' && isTyping && !isComplete">
        <span>{{ displayedText }}</span>
        <span class="inline-block w-0.5 h-4 sm:h-5 bg-primary-500 ml-1 animate-pulse"></span>
      </template>
      <template v-else>
        {{ message.content }}
      </template>

      <!-- Информация о лимитах (только для последнего сообщения ассистента) -->
      <div
        v-if="message.role === 'assistant' && isComplete && limitsInfo && props.isNew"
        class="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-400 flex items-center gap-1"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{{ limitsInfo }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import type { Message } from '@/services/llm'
import { useChatStore } from '@/stores/chat'
import { getProviderLimits } from '@/services/llm'

const props = defineProps<{
  message: Message
  isNew?: boolean
}>()

const chatStore = useChatStore()
const displayedText = ref('')
const isTyping = ref(false)
const isComplete = ref(false)

let typingInterval: NodeJS.Timeout | null = null
let currentIndex = 0

// Получаем актуальные лимиты
const limitsInfo = computed(() => {
  if (chatStore.provider === 'openrouter') {
    const limits = getProviderLimits('openrouter')
    if (limits.perMinute <= 20 && limits.perMinute !== Infinity) {
      return `ℹ️ Лимиты OpenRouter: ${limits.perMinute} запросов/мин, ${limits.perDay} запросов/день`
    }
  }
  return null
})

// Основной текст
const mainContent = computed(() => props.message.content)

watch(
  () => mainContent.value,
  (newContent) => {
    if (props.message.role === 'assistant' && props.isNew && newContent) {
      startTypingEffect(newContent)
    } else {
      displayedText.value = newContent
      isTyping.value = false
      isComplete.value = true
    }
  },
  { immediate: true },
)

const startTypingEffect = (fullText: string) => {
  if (typingInterval) clearInterval(typingInterval)

  displayedText.value = ''
  currentIndex = 0
  isTyping.value = true
  isComplete.value = false

  const typingSpeed = 30
  typingInterval = setInterval(() => {
    if (currentIndex < fullText.length) {
      displayedText.value += fullText[currentIndex]
      currentIndex++
      scrollToBottom()
    } else {
      if (typingInterval) clearInterval(typingInterval)
      isTyping.value = false
      isComplete.value = true
    }
  }, typingSpeed)
}

const scrollToBottom = () => {
  const container = document.querySelector('.messages-container')
  if (container) container.scrollTop = container.scrollHeight
}

onUnmounted(() => {
  if (typingInterval) clearInterval(typingInterval)
})
</script>

<style scoped>
.bg-response {
  @apply bg-blue-100;
}
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

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out forwards;
}
.animate-pulse {
  animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.animate-spin {
  animation: spin 1s linear infinite;
}

/* Адаптив */
@media (max-width: 480px) {
  .animate-slideUp {
    animation-duration: 0.25s;
  }
}
</style>
