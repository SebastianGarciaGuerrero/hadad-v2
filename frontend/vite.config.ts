import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy: toda llamada a /api se reenvía al backend FastAPI (puerto 8000).
// Así el frontend y el backend comparten origen (sin CORS), igual que en
// producción detrás de Nginx.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
