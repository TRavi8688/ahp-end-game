// staff-portal/src/apiClient.ts
//
// WHAT CHANGED vs existing file:
//  - Removed: src/api/client.ts (had hardcoded production URL + localStorage)
//    → DELETE that file: rm src/api/client.ts
//  - Token: reads from sessionStorage (not localStorage — PHI requirement)
//  - baseURL: reads VITE_API_BASE_URL env var only (no hardcoded URL)
//  - Auto-logout on 401 — clears session and redirects to /login
//
// ALL pages that previously imported from src/api/client.ts must now
// import from src/apiClient.ts (this file).

import axios, { AxiosInstance, AxiosResponse } from 'axios';

// FIXED: No hardcoded production URL
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// FIXED: Read from sessionStorage (not localStorage)
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('hospyn_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('hospyn_access_token');
      sessionStorage.removeItem('hospyn_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
