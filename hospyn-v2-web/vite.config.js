import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const PROD_API = 'https://hospyn-495906-api-625745217419.us-central1.run.app'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
      },
    },
  },
})
