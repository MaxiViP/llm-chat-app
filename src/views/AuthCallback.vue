<template>
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">Выполняется вход...</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

onMounted(async () => {
  await authStore.handleAuthCallback() // сохраняет пользователя из URL параметра token

  // После успешной авторизации редиректим на главную или сохранённый путь
  const redirect = route.query.redirect as string || '/'
  router.push(redirect)
})
</script>