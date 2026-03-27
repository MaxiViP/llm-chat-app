// src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export interface User {
	id: string
	email: string
	name: string
	avatarUrl?: string
	balance: number
	provider?: 'google' | 'yandex' | 'email' | null
}

export const useAuthStore = defineStore('auth', () => {
	const user = ref<User | null>(null)
	const token = ref<string | null>(null)

	const isAuthenticated = computed(() => !!user.value)

	function init() {
		const storedUser = localStorage.getItem('user')
		const storedToken = localStorage.getItem('token')
		if (storedUser && storedToken) {
			user.value = JSON.parse(storedUser)
			token.value = storedToken
		}
	}

	async function register(email: string, password: string, name?: string) {
		const { data } = await api.post('/auth/register', { email, password, name })
		user.value = data.user
		token.value = data.token
		localStorage.setItem('user', JSON.stringify(data.user))
		localStorage.setItem('token', data.token)
		return data.user
	}

	// Вход (обновлённая версия)
	async function login(provider: 'google' | 'yandex' | 'email', email?: string, password?: string) {
		if (provider === 'google') {
			window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`
			return null
		}

		if (provider === 'email') {
			if (!email || !password) {
				console.error('Email и пароль обязательны')
				return null
			}

			try {
				const { data } = await api.post('/auth/login', { email, password })
				user.value = data.user
				token.value = data.token
				localStorage.setItem('user', JSON.stringify(data.user))
				localStorage.setItem('token', data.token)
				return data.user
			} catch (err: any) {
				console.error('Ошибка логина:', err.response?.data?.error || err.message)
				return null
			}
		}

		return null
	}

	async function loginWithGoogle() {
		window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`
	}
 

	async function handleAuthCallback() {
		const urlParams = new URLSearchParams(window.location.search)
		const tokenFromUrl = urlParams.get('token')

		if (tokenFromUrl) {
			localStorage.setItem('token', tokenFromUrl)
			token.value = tokenFromUrl

			const { data } = await api.get('/auth/me')
			user.value = data
			localStorage.setItem('user', JSON.stringify(data))
		}
	}

	function logout() {
		user.value = null
		token.value = null
		localStorage.removeItem('user')
		localStorage.removeItem('token')
	}

	return {
		user,
		token,
		isAuthenticated,
		init,
		register,
		login,
		loginWithGoogle,
		handleAuthCallback,
		logout,
	}
})
