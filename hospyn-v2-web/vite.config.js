import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROD_API = 'https://hospyn-495906-api-625745217419.us-central1.run.app'

import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      react: path.dirname(require.resolve('react/package.json')),
      'react-dom': path.dirname(require.resolve('react-dom/package.json')),
    },
  },
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
