import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { backendDevPlugin } from './plugins/vite-plugin-backend.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [backendDevPlugin(), react(), tailwindcss()],
  server: {
    proxy: {
      // Use 127.0.0.1 so the proxy matches Node on Windows (avoids IPv6 ::1 vs IPv4 mismatches)
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
