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

// FIXED (BUG: every dashboard call 404'd in production):
//   healthcare-core mounts ALL its routes under /api/v1/healthcare/* (see
//   backend/healthcare-core/app/main.py: app.include_router(api_router,
//   prefix="/api/v1/healthcare")), and nginx only proxies /api/v1/healthcare/,
//   /api/v1/auth/, /api/v1/ai/, /api/v1/notifications/ — nothing else.
//   Every call site in this app (apiClient.get('/lab/orders'), etc.) was
//   written as if healthcare-core routes lived directly under /api/v1/*,
//   so 100% of non-auth dashboard requests were hitting nginx's 404 catch-all.
//   Rather than touch 40+ call sites individually (and risk missing one),
//   this interceptor rewrites the path centrally. Only /auth/*, /ai/*,
//   /notifications/* (and anything already prefixed /healthcare or an
//   absolute URL) are left untouched — those are real, separate services.
const PASSTHROUGH_PREFIXES = ['/auth', '/ai', '/notifications', '/healthcare'];

function withHealthcarePrefix(url?: string): string | undefined {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url; // absolute URL — leave alone
  const normalized = url.startsWith('/') ? url : `/${url}`;
  if (PASSTHROUGH_PREFIXES.some((p) => normalized.startsWith(p))) {
    return url;
  }
  return `/healthcare${normalized}`;
}

apiClient.interceptors.request.use((config) => {
  config.url = withHealthcarePrefix(config.url);
  if (config.url && config.url.startsWith('/')) {
    config.url = config.url.substring(1);
  }
  return config;
});

// FIXED: Read from sessionStorage (not localStorage)
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('hospain_access_token');
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
      sessionStorage.removeItem('hospain_access_token');
      sessionStorage.removeItem('hospain_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
