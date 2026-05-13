import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Allow access via IP address
    port: 9020,       // Frontend server port
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9010',  // Backend API server
        changeOrigin: true,
      },
    },
  },
})