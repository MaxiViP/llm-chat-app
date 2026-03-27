import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/',
			name: 'chat',
			component: () => import('@/views/ChatView.vue'),
			meta: { requiresAuth: true },
		},
		{
			path: '/profile',
			name: 'profile',
			component: () => import('@/views/ProfileView.vue'),
			meta: { requiresAuth: true },
		},
		{
			path: '/auth/callback',
			name: 'AuthCallback',
			component: () => import('@/views/AuthCallback.vue'),
			meta: { requiresAuth: false },
		},
		{
			path: '/login',
			name: 'login',
			component: () => import('@/views/LoginView.vue'),
			meta: { requiresAuth: false },
		},
	],
})

router.beforeEach(async (to, from) => {
	const authStore = useAuthStore()

	// Инициализация (синхронная, но для надёжности вызываем)
	if (!authStore.user) {
		authStore.init()
	}

	// Если маршрут требует авторизации, а пользователь не авторизован
	if (to.meta.requiresAuth && !authStore.isAuthenticated) {
		// Сохраняем путь для редиректа после входа
		return `/login?redirect=${encodeURIComponent(to.fullPath)}`
	}

	// Если авторизован и пытается зайти на страницу логина
	if (to.path === '/login' && authStore.isAuthenticated) {
		return '/'
	}

	// Разрешаем переход
	return true
})

export default router
