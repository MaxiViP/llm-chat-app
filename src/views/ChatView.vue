<template>
  <div class="chat-view flex flex-col h-screen bg-gray-50">
    <!-- Header -->
    <header class="flex justify-center items-center p-2 bg-white border-b shadow-sm w-full sticky top-0 z-10">
      <div class="flex items-center gap-3 flex-1">
        <div v-if="store.isModelsLoading" class="text-gray-500 text-sm">Загрузка моделей...</div>
        <ModelSelect v-else />
      </div>

      <div class="flex items-center gap-2 ml-auto flex-shrink-0">
        <!-- QR-код кнопка -->
        <button
          v-if="!authStore.isAuthenticated"
          @click="showAuthModal = true"
          class="flex items-center gap-2 px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition md:pr-4"
        >
          <span>👤</span>
          <span class="hidden sm:inline">Войти</span>
        </button>

        <RouterLink
          v-else
          to="/profile"
          class="flex items-center gap-2 hover:bg-gray-100 rounded-full p-2 transition-colors"
        >
          <div
            class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600"
          >
            {{ authStore.user?.name?.charAt(0).toUpperCase() || '👤' }}
          </div>
          <span class="hidden sm:inline text-sm text-gray-700">{{ authStore.user?.name }}</span>
        </RouterLink>
      </div>
    </header>

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

    <!-- Модальное окно авторизации -->
    <AuthModal v-model:visible="showAuthModal" @login="handleLogin" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import ModelSelect from '@/components/ModelSelect.vue'
import AuthModal from '@/components/AuthModal.vue'

const store = useChatStore()
const authStore = useAuthStore()
const messagesContainer = ref<HTMLElement | null>(null)
const inputWrapperRef = ref<HTMLElement | null>(null)
const showAuthModal = ref(false)

const displayMessages = computed(() => store.messages.filter((m) => m.role !== 'system'))

const handleSend = (msg: string) => store.sendMessage(msg)
const handleLogin = () => {
  console.log('Пользователь авторизован')
}

const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
  if (!messagesContainer.value) return
  nextTick(() => {
    requestAnimationFrame(() =>
      messagesContainer.value?.scrollTo({ top: messagesContainer.value.scrollHeight, behavior }),
    )
  })
}

let scrollInterval: NodeJS.Timeout | null = null

watch(
  () => store.isLoading,
  (isLoading) => {
    if (isLoading) {
      scrollInterval = setInterval(() => scrollToBottom('auto'), 100)
    } else {
      if (scrollInterval) {
        clearInterval(scrollInterval)
        scrollInterval = null
      }
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

onUnmounted(() => {
  if (scrollInterval) {
    clearInterval(scrollInterval)
  }
})
</script>

<style scoped>
/* Анимации */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.animate-slideUp { animation: slideUp 0.3s ease-out forwards; }
.animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
.animate-bounce { animation: bounce 1.4s infinite ease-in-out both; }

.delay-75 { animation-delay: 0.1s; }
.delay-150 { animation-delay: 0.2s; }
</style>
