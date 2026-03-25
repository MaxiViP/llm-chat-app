// stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
	id: string
	email: string
	name: string
	avatar?: string
	balance: number
	provider: 'google' | 'yandex' | 'email'
}

export const useAuthStore = defineStore('auth', () => {
	const user = ref<User | null>(null)
	const token = ref<string | null>(null)

	const isAuthenticated = computed(() => !!user.value)

	// Инициализация из localStorage
	function init() {
		const storedUser = localStorage.getItem('user')
		const storedToken = localStorage.getItem('token')
		if (storedUser && storedToken) {
			user.value = JSON.parse(storedUser)
			token.value = storedToken
		}
	}

	// Вход
	async function login(provider: 'google' | 'yandex' | 'email', email?: string) {
		// Ваша логика входа
		let newUser: User | null = null

		if (provider === 'google') {
			newUser = {
				id: 'google_' + Date.now(),
				email: 'user@gmail.com',
				name: 'Google User',
				avatar: 'https://via.placeholder.com/40',
				balance: 100,
				provider: 'google',
			}
		} else if (provider === 'yandex') {
			newUser = {
				id: 'yandex_' + Date.now(),
				email: 'user@yandex.ru',
				name: 'Yandex User',
				avatar: 'https://via.placeholder.com/40',
				balance: 100,
				provider: 'yandex',
			}
		} else if (provider === 'email') {
			if (!email) return null

			const safeEmail: string = email

			newUser = {
				id: 'email_' + Date.now(),
				email: safeEmail,
				name: (safeEmail.split('@')[0] || '').replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
				balance: 0,
				provider: 'email',
			}
		}

		if (newUser) {
			user.value = newUser
			token.value = 'mock-token'
			localStorage.setItem('user', JSON.stringify(newUser))
			localStorage.setItem('token', 'mock-token')
		}
		return newUser
	}

	// Выход
	function logout() {
		user.value = null
		token.value = null
		localStorage.removeItem('user')
		localStorage.removeItem('token')
		// Можно также очистить историю транзакций
		localStorage.removeItem('transactions')
	}

	// Обновление баланса
	function updateBalance(newBalance: number) {
		if (user.value) {
			user.value.balance = newBalance
			localStorage.setItem('user', JSON.stringify(user.value))
		}
	}

	// Обновление профиля
	function updateProfile(name: string, email: string) {
		if (user.value) {
			user.value.name = name
			user.value.email = email
			localStorage.setItem('user', JSON.stringify(user.value))
		}
	}

	return {
		user,
		token,
		isAuthenticated,
		init,
		login,
		logout,
		updateBalance,
		updateProfile,
	}
})
