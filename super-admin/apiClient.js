/**
 * src/lib/apiClient.js
 *
 * SINGLE SOURCE OF TRUTH for all HTTP calls in the Super Admin Dashboard.
 *
 * ACTION REQUIRED (manual):
 *   1. Keep ONLY this file.
 *   2. DELETE src/services/apiClient.js
 *   3. Run: grep -r "services/apiClient" src/ --include="*.jsx" --include="*.js" -l
 *      then update each found file to import from '../lib/apiClient' or '../../lib/apiClient'
 *
 * This file:
 *   - Reads the base URL from VITE_API_BASE_URL env var (falls back to https://api.hospyn.in)
 *   - Auto-injects the Bearer token from Zustand authStore on every request
 *   - On 401 → clears auth store and redirects to /login
 *   - On 403 → redirects to /unauthorized
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.hospyn.in';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: inject token ──────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    // Read directly from localStorage (avoids circular import from authStore)
    const raw   = localStorage.getItem('hospyn-auth-store');
    const token = raw ? (() => { try { return JSON.parse(raw)?.state?.token; } catch { return null; } })() : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: handle auth errors ───────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Token expired or invalid — clear auth and redirect
      localStorage.removeItem('hospyn-auth-store');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    if (status === 403) {
      // Forbidden — wrong role
      if (window.location.pathname !== '/unauthorized') {
        window.location.href = '/unauthorized';
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
