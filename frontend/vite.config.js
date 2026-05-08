import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9020,
    proxy: {
      '/api': {
        target: 'http://localhost:9010',
        changeOrigin: true,
      },
    },
  },
})