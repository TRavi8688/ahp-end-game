import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    headers: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:8080 ws://localhost:8080 http: ws:;"
    },
    proxy: {
      '/api': {
        target: 'https://hospyn-495906-api-625745217419.us-central1.run.app',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'build',
  },
});
