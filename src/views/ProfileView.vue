<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Заголовок с кнопкой назад -->
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-2">
          <button
            @click="goBack"
            class="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group"
          >
            <svg
              class="w-5 h-5 transform group-hover:-translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Назад</span>
          </button>
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Личный кабинет</h1>
        <p class="text-gray-600 mt-1">Управляйте балансом и настройками</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Левая колонка: профиль и баланс -->
        <div class="lg:col-span-1 space-y-6">
          <!-- Карточка пользователя -->
          <div class="bg-white rounded-xl shadow-sm p-6">
            <div class="flex items-center space-x-4">
              <div
                class="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-2xl text-primary-600"
              >
                {{ userInitials }}
              </div>
              <div>
                <h2 class="text-lg font-semibold text-gray-900">
                  {{ authStore.user?.name || 'Пользователь' }}
                </h2>
                <p class="text-gray-500 text-sm">
                  {{ authStore.user?.email || 'email@example.com' }}
                </p>
                <div class="mt-1 text-xs text-gray-400">
                  {{
                    authStore.user?.provider === 'google'
                      ? 'Google аккаунт'
                      : authStore.user?.provider === 'yandex'
                        ? 'Яндекс аккаунт'
                        : 'Email аккаунт'
                  }}
                </div>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t">
              <div class="flex justify-between items-center">
                <span class="text-gray-600">Баланс</span>
                <span class="text-2xl font-bold text-primary-600">{{ formattedBalance }} ₽</span>
              </div>
              <button @click="openDepositModal = true" class="mt-4 w-full btn-primary">
                Пополнить
              </button>
            </div>
          </div>

          <!-- Статистика -->
          <div class="bg-white rounded-xl shadow-sm p-6">
            <h3 class="font-medium text-gray-900 mb-3">Статистика</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Всего пополнений:</span>
                <span class="font-medium">{{ totalDeposits }} ₽</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Использовано:</span>
                <span class="font-medium">{{ totalUsage }} ₽</span>
              </div>
              <div class="flex justify-between pt-2 border-t">
                <span class="text-gray-600">Доступно:</span>
                <span class="font-bold text-primary-600">{{ formattedBalance }} ₽</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Правая колонка: транзакции и настройки -->
        <div class="lg:col-span-2 space-y-6">
          <!-- История транзакций -->
          <div class="bg-white rounded-xl shadow-sm p-6">
            <h3 class="font-medium text-gray-900 mb-4">История операций</h3>
            <div v-if="transactions.length === 0" class="text-center py-8 text-gray-500">
              Пока нет операций
            </div>
            <div v-else class="space-y-3 max-h-96 overflow-y-auto">
              <div
                v-for="tx in transactions"
                :key="tx.id"
                class="flex justify-between items-center py-2 border-b last:border-0"
              >
                <div>
                  <div class="font-medium text-gray-800">{{ tx.description }}</div>
                  <div class="text-xs text-gray-400">{{ formatDate(tx.date) }}</div>
                </div>
                <div class="text-right">
                  <div :class="tx.amount > 0 ? 'text-green-600' : 'text-red-600'">
                    {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount.toFixed(2) }} ₽
                  </div>
                  <div class="text-xs text-gray-400 capitalize">{{ tx.status }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Настройки профиля -->
          <div class="bg-white rounded-xl shadow-sm p-6">
            <h3 class="font-medium text-gray-900 mb-4">Настройки профиля</h3>
            <form @submit.prevent="updateProfile">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                  <input v-model="profileForm.name" type="text" class="input" required />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input v-model="profileForm.email" type="email" class="input" required />
                </div>
                <div>
                  <button type="submit" class="btn-primary">Сохранить изменения</button>
                </div>
              </div>
            </form>
          </div>

          <!-- Кнопка выхода -->
          <div class="bg-white rounded-xl shadow-sm p-6">
            <div class="border border-red-200 rounded-lg p-4 bg-red-50">
              <div class="flex items-start gap-3">
                <div class="text-red-600 text-xl">⚠️</div>
                <div class="flex-1">
                  <h4 class="font-medium text-red-800 mb-1">Выход из аккаунта</h4>
                  <p class="text-sm text-red-600 mb-3">
                    После выхода вам потребуется снова войти для доступа к личному кабинету
                  </p>
                  <button
                    @click="handleLogout"
                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Выйти из аккаунта
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно пополнения -->
    <Teleport to="body">
      <div
        v-if="openDepositModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn"
        @click.self="openDepositModal = false"
      >
        <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4 animate-scaleIn">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Пополнение баланса</h3>
            <button @click="openDepositModal = false" class="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
          <form @submit.prevent="handleDeposit">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Сумма (₽)</label>
                <input
                  v-model.number="depositAmount"
                  type="number"
                  min="1"
                  step="100"
                  class="input"
                  required
                />
                <div class="mt-2 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    @click="depositAmount = 100"
                    class="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    100 ₽
                  </button>
                  <button
                    type="button"
                    @click="depositAmount = 500"
                    class="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    500 ₽
                  </button>
                  <button
                    type="button"
                    @click="depositAmount = 1000"
                    class="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    1000 ₽
                  </button>
                  <button
                    type="button"
                    @click="depositAmount = 5000"
                    class="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    5000 ₽
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Способ оплаты</label>
                <select v-model="depositMethod" class="input">
                  <option value="card">💳 Банковская карта</option>
                  <option value="sbp">📱 СБП</option>
                  <option value="yoomoney">💰 ЮMoney</option>
                </select>
              </div>
              <div class="flex gap-3 pt-2">
                <button type="submit" class="btn-primary flex-1">Пополнить</button>
                <button
                  type="button"
                  @click="openDepositModal = false"
                  class="btn-secondary flex-1"
                >
                  Отмена
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()

// Профиль форма
const profileForm = reactive({
  name: authStore.user?.name || '',
  email: authStore.user?.email || '',
})

// Пополнение
const openDepositModal = ref(false)
const depositAmount = ref(100)
const depositMethod = ref('card')

// Вычисления
const formattedBalance = computed(() => {
  return (authStore.user?.balance || 0).toFixed(2)
})

const userInitials = computed(() => {
  const name = authStore.user?.name || 'U'
  return name.charAt(0).toUpperCase()
})

// Транзакции
const transactions = ref<
  Array<{
    id: number
    date: Date
    amount: number
    description: string
    status: string
    type: string
  }>
>([])

const totalDeposits = computed(() => {
  return transactions.value
    .filter((tx) => tx.type === 'deposit' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)
    .toFixed(2)
})

const totalUsage = computed(() => {
  return transactions.value
    .filter((tx) => tx.type === 'usage' && tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    .toFixed(2)
})

// Навигация назад
const goBack = () => {
  router.back()
}

// Методы
const updateProfile = () => {
  if (authStore.user) {
    authStore.user.name = profileForm.name
    authStore.user.email = profileForm.email
    localStorage.setItem('user', JSON.stringify(authStore.user))
    alert('Профиль успешно обновлен!')
  }
}

const handleDeposit = () => {
  if (depositAmount.value <= 0) {
    alert('Введите корректную сумму')
    return
  }

  const methodNames: Record<string, string> = {
    card: 'Банковская карта',
    sbp: 'СБП',
    yoomoney: 'ЮMoney',
  }

  transactions.value.unshift({
    id: Date.now(),
    date: new Date(),
    amount: depositAmount.value,
    description: `Пополнение через ${methodNames[depositMethod.value]}`,
    status: 'completed',
    type: 'deposit',
  })

  if (authStore.user) {
    authStore.user.balance = (authStore.user.balance || 0) + depositAmount.value
    localStorage.setItem('user', JSON.stringify(authStore.user))
  }

  alert(`Баланс пополнен на ${depositAmount.value} ₽`)
  openDepositModal.value = false
  depositAmount.value = 100
}

const handleLogout = () => {
  if (confirm('Вы уверены, что хотите выйти из аккаунта?')) {
    authStore.logout()
    router.push('/')
  }
}

const formatDate = (date: Date | string) => {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return '—' // вместо ошибки
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const loadTransactions = () => {
  const saved = localStorage.getItem('transactions')
  if (saved) {
    const parsed = JSON.parse(saved)
    transactions.value = parsed.map((tx: any) => ({
      ...tx,
      date: tx.date ? new Date(tx.date) : new Date(), // безопасно
    }))
  } else {
    transactions.value = [
      {
        id: 1,
        date: new Date(Date.now() - 86400000),
        amount: 500,
        description: 'Пополнение баланса',
        status: 'completed',
        type: 'deposit',
      },
      {
        id: 2,
        date: new Date(Date.now() - 172800000),
        amount: -150,
        description: 'Использование API',
        status: 'completed',
        type: 'usage',
      },
    ]
  }
}

const saveTransactions = () => {
  localStorage.setItem('transactions', JSON.stringify(transactions.value))
}

watch(
  transactions,
  () => {
    saveTransactions()
  },
  { deep: true },
)

onMounted(() => {
  loadTransactions()
  if (!authStore.isAuthenticated) {
    router.push('/')
  }
})
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out;
}

.btn-primary {
  @apply px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50;
}

.btn-secondary {
  @apply px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200;
}

.input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent;
}
</style>
