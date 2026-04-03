import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Transaction {
  id: string
  date: Date
  amount: number
  type: 'deposit' | 'withdrawal' | 'usage'
  status: 'completed' | 'pending' | 'failed'
  description: string
}

export const useUserStore = defineStore('user', () => {
  // Баланс (в рублях или кредитах)
  const balance = ref(0)
  const transactions = ref<Transaction[]>([])
  const userName = ref('Пользователь')
  const email = ref('user@example.com')

  // Загрузка из localStorage
  const loadFromStorage = () => {
    const savedBalance = localStorage.getItem('user_balance')
    if (savedBalance) balance.value = parseFloat(savedBalance)
    const savedTransactions = localStorage.getItem('user_transactions')
    if (savedTransactions)
      transactions.value = JSON.parse(savedTransactions, (key, value) => {
        if (key === 'date') return new Date(value)
        return value
      })
    const savedName = localStorage.getItem('user_name')
    if (savedName) userName.value = savedName
    const savedEmail = localStorage.getItem('user_email')
    if (savedEmail) email.value = savedEmail
  }

  // Сохранение в localStorage
  const saveToStorage = () => {
    localStorage.setItem('user_balance', balance.value.toString())
    localStorage.setItem('user_transactions', JSON.stringify(transactions.value))
    localStorage.setItem('user_name', userName.value)
    localStorage.setItem('user_email', email.value)
  }

  // Пополнение баланса
  const deposit = (amount: number, method: string) => {
    if (amount <= 0) return false
    // Симуляция платежа
    const transaction: Transaction = {
      id: Date.now().toString(),
      date: new Date(),
      amount,
      type: 'deposit',
      status: 'completed',
      description: `Пополнение через ${method}`,
    }
    transactions.value.unshift(transaction)
    balance.value += amount
    saveToStorage()
    return true
  }

  // Списание (для будущего использования, например, за запросы)
  const withdraw = (amount: number, description: string) => {
    if (amount <= 0) return false
    if (balance.value < amount) return false
    const transaction: Transaction = {
      id: Date.now().toString(),
      date: new Date(),
      amount: -amount,
      type: 'usage',
      status: 'completed',
      description,
    }
    transactions.value.unshift(transaction)
    balance.value -= amount
    saveToStorage()
    return true
  }

  // Обновление профиля
  const updateProfile = (name: string, newEmail: string) => {
    userName.value = name
    email.value = newEmail
    saveToStorage()
  }
  // Инициализация
  loadFromStorage()

  return {
    balance,
    transactions,
    userName,
    email,
    deposit,
    withdraw,
    updateProfile,
  }
})
