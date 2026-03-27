<!-- components/AuthModal.vue -->
<template>
	<Teleport to="body">
		<div v-if="visible" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="close">
			<div class="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" @click.stop>
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-semibold">Вход / Регистрация</h2>
					<button @click="close" class="text-gray-500 hover:text-gray-700">✕</button>
				</div>

				<div class="space-y-4">
					<!-- OAuth кнопки -->
					<button
						@click="loginWith('google')"
						class="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
					>
						<img src="https://www.google.com/favicon.ico" class="w-5 h-5" />
						<span>Войти через Google</span>
					</button>

					<button
						@click="loginWith('yandex')"
						class="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
					>
						<img src="https://yandex.ru/favicon.ico" class="w-5 h-5" />
						<span>Войти через Яндекс</span>
					</button>

					<!-- Кнопка суперпользователя -->
					<button
						@click="loginAsSuperuser"
						:disabled="loading"
						class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-1 1v8a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V6a4 4 0 00-4-4zm0 2a2 2 0 00-2 2v1h4V6a2 2 0 00-2-2zm0 7a1 1 0 100 2 1 1 0 000-2z"
								clip-rule="evenodd"
							/>
						</svg>
						<span>Войти как суперпользователь</span>
					</button>

					<div class="relative">
						<div class="absolute inset-0 flex items-center">
							<div class="w-full border-t"></div>
						</div>
						<div class="relative flex justify-center text-sm">
							<span class="bg-white px-2 text-gray-500">или</span>
						</div>
					</div>

					<!-- Email форма -->
					<form @submit.prevent="loginWithEmail">
						<input
							v-model="email"
							type="email"
							placeholder="Email"
							required
							class="w-full px-3 py-2 border rounded-lg mb-2"
						/>
						<button
							type="submit"
							class="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition"
						>
							Получить код на почту
						</button>
					</form>

					<!-- Поле для ввода кода (появляется после отправки email) -->
					<div v-if="showCodeInput">
						<input v-model="code" type="text" placeholder="Код из письма" class="w-full px-3 py-2 border rounded-lg" />
						<button
							@click="verifyCode"
							class="w-full mt-2 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition"
						>
							Подтвердить
						</button>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'

const emit = defineEmits<{
	(e: 'close'): void
	(e: 'login'): void
}>()

const visible = defineModel<boolean>('visible', { default: false })

const authStore = useAuthStore()
const email = ref('')
const code = ref('')
const showCodeInput = ref(false)
const pendingEmail = ref('')
const loading = ref(false)

const close = () => {
	visible.value = false
	emit('close')
}

const loginWith = async (provider: 'google' | 'yandex') => {
	await authStore.login(provider)
	close()
	emit('login')
}

// ✅ вход суперпользователя
const loginAsSuperuser = async () => {
	try {
		loading.value = true
		const res = await api.post('/auth/superuser') // предполагаемый эндпоинт
		const { user, token } = res.data

		// сохраняем
		localStorage.setItem('user', JSON.stringify(user))
		localStorage.setItem('token', token)

		// обновляем store
		authStore.user = user
		authStore.token = token

		close()
		emit('login')
	} catch (err: any) {
		alert(err.response?.data?.error || 'Ошибка входа суперпользователя')
	} finally {
		loading.value = false
	}
}

// ✅ отправка кода
const loginWithEmail = async () => {
	if (!email.value) return

	try {
		loading.value = true

		pendingEmail.value = email.value

		await api.post('/auth/send-code', {
			email: email.value,
		})

		showCodeInput.value = true
	} catch (err: any) {
		alert(err.response?.data?.error || 'Ошибка отправки кода')
	} finally {
		loading.value = false
	}
}

// ✅ проверка кода
const verifyCode = async () => {
	if (!code.value) return

	try {
		loading.value = true

		const res = await api.post('/auth/verify-code', {
			email: pendingEmail.value,
			code: code.value,
		})

		const { user, token } = res.data

		// сохраняем
		localStorage.setItem('user', JSON.stringify(user))
		localStorage.setItem('token', token)

		// обновляем store
		authStore.user = user
		authStore.token = token

		close()
		emit('login')
	} catch (err: any) {
		alert(err.response?.data?.error || 'Неверный код')
	} finally {
		loading.value = false
	}
}
</script>
