<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <AuthModal :visible="true" @close="handleClose" @login="handleLogin" />
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import AuthModal from '@/components/AuthModal.vue'

const router = useRouter()
const route = useRoute()

const handleClose = () => {
  router.push('/')
}

const handleLogin = () => {
  // После успешного входа редиректим на сохранённый путь или на главную
  const redirect = (route.query.redirect as string) || '/'
  router.push(redirect)
}
</script>