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
    port: 5175,
    strictPort: true,
    headers: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http: ws: https: wss:;"
    },
    proxy: {
      '/api': {
        target: 'https://hospyn-495906-api-625745217419.us-central1.run.app',
        changeOrigin: true,
      },
      '/ws': {
        target: 'https://hospyn-495906-api-625745217419.us-central1.run.app',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'build',
  },
});
