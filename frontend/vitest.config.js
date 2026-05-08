import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
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