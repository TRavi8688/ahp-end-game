/// <reference types="vite/client" />
/**
 * FIXED: Previously two competing clients existed:
 *   - src/apiClient.ts  → read token from localStorage('token'), baseURL had no /api/v1
 *   - src/api/client.ts → read token from sessionStorage('hospyn_access_token'), had /api/v1
 *
 * ALL pages import from '../../apiClient' (the root one).
 * This file is now the single source of truth. src/api/client.ts re-exports from here.
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
  : 'http://localhost:8000/api/v1';

const generateTraceId = () => `req_${Math.random().toString(36).slice(2, 12)}`;

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  config.headers['X-Request-ID'] = generateTraceId();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
