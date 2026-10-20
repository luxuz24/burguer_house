import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Em dev, '/api' é encaminhado para o backend local (evita CORS e URL fixa no código)
  const alvoApi = env.VITE_PROXY_TARGET || 'http://localhost:3000'

  const certPath = path.resolve(process.cwd(), '.cert.local/cert.pem')
  const keyPath = path.resolve(process.cwd(), '.cert.local/key.pem')
  const usarHttps =
    env.VITE_HTTPS === 'true' && fs.existsSync(certPath) && fs.existsSync(keyPath)

  return {
    plugins: [react()],
    server: {
      allowedHosts: true,
      ...(usarHttps
        ? {
            https: {
              key: fs.readFileSync(keyPath),
              cert: fs.readFileSync(certPath),
            },
          }
        : {}),
      proxy: {
        '/api': { target: alvoApi, changeOrigin: true },
      },
    },
  }
})

