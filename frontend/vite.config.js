import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Allow access via IP address
    port: 9020,
    proxy: {
      '/api': {
        target: 'http://localhost:9010',
        changeOrigin: true,
      },
    },
  },
})