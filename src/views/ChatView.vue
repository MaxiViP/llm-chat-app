<template>
  <div class="chat-view">
    <div class="header">
      <div class="model-info">
        <div v-if="store.isModelsLoading" class="loading-models">Загрузка моделей...</div>
        <ModelSelect v-else v-model="selectedModel" :options="store.availableModels" />
        <span v-if="store.isLoading" class="status-dot thinking">• думает…</span>
        <span v-else class="status-dot ready">• готов</span>
      </div>

      <button @click="checkConnection" class="test-btn">🔌 Проверить API</button>
    </div>

    <div class="messages-container" ref="messagesContainer">
      <ChatMessage v-for="(msg, idx) in displayMessages" :key="idx" :message="msg" />

      <div v-if="store.isLoading" class="loading-indicator">
        <div class="dots"><span></span><span></span><span></span></div>
        <span v-if="displayMessages.length === 0">🤔 Думаю над первым ответом…</span>
        <span v-else>печатает…</span>
      </div>
    </div>

    <ChatInput :disabled="store.isLoading" @send="handleSend" />

    <div class="controls">
      <button class="clear-btn" @click="clearChat">🗑️ Очистить чат</button>
      <!-- кнопка обновления списка (опционально) -->
      <button v-if="!store.isModelsLoading" @click="store.loadAvailableModels(true)">
        🔄 Обновить модели
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue' // ← здесь добавлен onMounted!
import { useChatStore } from '@/stores/chat'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import ModelSelect from '@/components/ModelSelect.vue'
import { testConnection as testApiConnection } from '@/services/llm'

const store = useChatStore()

const messagesContainer = ref<HTMLElement | null>(null)

const selectedModel = computed({
  get: () => store.selectedModel,
  set: (value) => {
    store.selectedModel = value
  },
})

const displayMessages = computed(() => store.messages.filter((m) => m.role !== 'system'))

const isLoading = computed(() => store.isLoading)

const handleSend = (message: string) => {
  store.sendMessage(message)
}

const clearChat = () => {
  store.clearChat()
}

const checkConnection = async () => {
  const isConnected = await testApiConnection()
  alert(
    isConnected
      ? '✅ API подключение успешно!'
      : '❌ Ошибка подключения. Проверьте ключ и настройки шлюза.',
  )
}

// Прокрутка вниз при новых сообщениях и во время стриминга
watch(
  () => store.messages.length,
  async () => {
    await nextTick()
    scrollToBottom()
  },
  { deep: true },
)

watch(
  () => store.isLoading,
  (newVal) => {
    if (newVal) {
      nextTick(scrollToBottom)
    }
  },
)

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Инициализация прокрутки после монтирования компонента
onMounted(() => {
  nextTick(scrollToBottom)
})
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f8f9fa;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.model-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-dot {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.status-dot.thinking {
  background: #fff3cd;
  color: #856404;
}

.status-dot.ready {
  background: #d4edda;
  color: #155724;
}

.test-btn {
  padding: 8px 14px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.test-btn:hover {
  background: #36a46e;
  transform: translateY(-1px);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #777;
  font-size: 14px;
  padding: 16px 0;
  justify-content: center;
  opacity: 0.8;
}

.loading-models {
  padding: 6px 12px;
  color: #666;
  font-size: 14px;
}

.dots {
  display: flex;
  gap: 6px;
}

.dots span {
  width: 8px;
  height: 8px;
  background: #42b883;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dots span:nth-child(1) {
  animation-delay: -0.32s;
}
.dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.controls {
  padding: 12px 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
  text-align: center;
  flex-shrink: 0;
}

.clear-btn {
  padding: 10px 24px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: #d32f2f;
  transform: translateY(-1px);
}
</style>
