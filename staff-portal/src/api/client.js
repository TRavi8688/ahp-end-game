/**
 * AHP Staff Portal — API Client
 *
 * Enterprise-grade Axios instance with:
 *  - Automatic JWT injection from secure token store
 *  - X-Request-ID trace header on every request
 *  - Structured error normalization (matches StandardErrorSchema)
 *  - 401 handling that clears auth state and redirects to login
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Utility: generate a short trace ID for correlation
const generateTraceId = () => `req_${Math.random().toString(36).slice(2, 12)}`;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// --- Request Interceptor ---
apiClient.interceptors.request.use((config) => {
  // Inject JWT
  const token = sessionStorage.getItem('ahp_access_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;

  // Inject Trace ID (propagated through backend → worker → audit log)
  config.headers['X-Request-ID'] = generateTraceId();

  return config;
});

// --- Response Interceptor ---
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    // Normalize to StandardErrorSchema
    const normalized = {
      error_code: detail?.error_code || 'UNKNOWN_ERROR',
      message: detail?.message || error.message || 'An unexpected error occurred.',
      trace_id: detail?.trace_id || error.config?.headers?.['X-Request-ID'],
      status,
    };

    if (status === 401) {
      // Token revoked or expired — clear state and force re-login
      sessionStorage.removeItem('ahp_access_token');
      sessionStorage.removeItem('ahp_user');
      window.location.href = '/login';
    }

    return Promise.reject(normalized);
  }
);

// --- API Modules ---

export const authAPI = {
  login: (email, password) =>
    apiClient.post('/auth/login', new URLSearchParams({ username: email, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
};

export const hospitalAPI = {
  create: (data, idempotencyKey) =>
    apiClient.post('/hospital/', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  addDepartment: (hospitalId, data) =>
    apiClient.post(`/hospital/${hospitalId}/departments`, data),
  get: (hospitalId) =>
    apiClient.get(`/hospital/${hospitalId}`),
};
