import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

import { createRequire } from 'module'

const require = createRequire(import.meta.url)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react': path.dirname(require.resolve('react/package.json')),
      'react-dom': path.dirname(require.resolve('react-dom/package.json')),
    }
  },
  server: {
    port: 5177,
    // FIX: proxy /api calls to backend so CORS doesn't block local dev
    proxy: {
      '/api': {
        target: 'https://hospyn-495906-api-625745217419.asia-south1.run.app',
        changeOrigin: true,
        secure: true,
      },
      '/webhooks': {
        target: 'https://hospyn-495906-api-625745217419.asia-south1.run.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
