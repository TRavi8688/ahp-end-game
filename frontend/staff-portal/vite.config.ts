import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * FIXED:
 * 1. Added WebSocket proxy entry for /api/v1/ws — without this, WS connections
 *    fail in dev because the browser tries to open ws://localhost:3000/api/v1/ws
 *    and Vite doesn't forward it.
 * 2. Kept existing /api proxy for REST calls.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // REST API
      '/api': {
        target:      'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // WebSocket — FIXED: required so WS upgrades are forwarded in dev
      '/api/v1/ws': {
        target:      'ws://127.0.0.1:8000',
        changeOrigin: true,
        ws:           true,
      },
    },
  },
});
