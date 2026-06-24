import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// HOSPAIN Partner App — Vite build config
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          ui: ['lucide-react'],
        },
      },
    },
  },
  define: {
    // Injected at build time for the about page
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BRAND__: JSON.stringify('HOSPAIN'),
  },
})
