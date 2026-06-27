import axios from 'axios';
import { API_BASE_URL } from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// Token helpers — sessionStorage ONLY (nothing persisted to disk/localStorage).
// GCP Cloud Run is stateless; the session lives in the browser tab only.
// ─────────────────────────────────────────────────────────────────────────────
export const getToken = () => sessionStorage.getItem('hospyn_partner_token');
export const setToken = (t) => sessionStorage.setItem('hospyn_partner_token', t);
export const clearToken = () => {
  sessionStorage.removeItem('hospyn_partner_token');
  sessionStorage.removeItem('hospyn_partner_user');
};

// ─────────────────────────────────────────────────────────────────────────────
// Route prefix logic — confirmed against nginx.conf and main.py:
//
//   /api/v1/auth/*          → nginx → auth-service:8001          (NO /healthcare/)
//   /api/v1/healthcare/*    → nginx → healthcare-core:8002        (WITH /healthcare/)
//
//   Inside healthcare-core, api_router is mounted at /api/v1/healthcare:
//     /api/v1/healthcare/onboarding/*   ← onboarding (register, PAN OTP)
//     /api/v1/healthcare/pharmacy/*     ← pharmacy + walkin + orders + ops
//     /api/v1/healthcare/staff/*        ← staff management
//     /api/v1/healthcare/clinical/*     ← prescriptions
//     /api/v1/healthcare/patients/*     ← patient search
//
//   So our frontend calls need:
//     /auth/login                  → stays as-is   → /api/v1/auth/login
//     /pharmacy/orders             → add /healthcare → /api/v1/healthcare/pharmacy/orders
//     /onboarding/register-*       → add /healthcare → /api/v1/healthcare/onboarding/register-enterprise
//     /staff/list                  → add /healthcare → /api/v1/healthcare/staff/list
// ─────────────────────────────────────────────────────────────────────────────

// Only these paths go to auth-service (no /healthcare prefix)
const AUTH_SERVICE_PATHS = ['/auth/'];

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

let onAuthFailureCallback = null;
export const setAuthFailureCallback = (cb) => { onAuthFailureCallback = cb; };

// ── Request interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  // 1. Attach bearer token
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // 2. Route prefix:
  //    - /auth/* → no prefix (goes to auth-service via nginx /api/v1/auth/)
  //    - everything else (onboarding, pharmacy, staff, clinical, patients) →
  //      add /healthcare (goes to healthcare-core via nginx /api/v1/healthcare/)
  const isAuthService = AUTH_SERVICE_PATHS.some((p) => config.url?.startsWith(p));
  if (!isAuthService && config.url && !config.url.startsWith('/healthcare')) {
    config.url = '/healthcare' + config.url;
  }

  return config;
});

// ── Response interceptor ─────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    if (error.response?.status === 401) {
      console.error('[HOSPAIN Partner] Session expired or token invalid — logging out.');
      clearToken();
      if (onAuthFailureCallback) onAuthFailureCallback();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
