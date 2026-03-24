import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api/groq': {
        target: 'https://gateway.ai.cloudflare.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/groq/, `/v1/95d012e0060154dcf0f18a00f92bd810/my-groq-gateway/groq`),
        secure: false,
      },
    },
  },
})
