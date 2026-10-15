import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Em dev, '/api' é encaminhado para o backend local (evita CORS e URL fixa no código)
  const alvoApi = env.VITE_PROXY_TARGET || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: alvoApi, changeOrigin: true },
      },
    },
  }
})
