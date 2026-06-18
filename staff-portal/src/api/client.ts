import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1';

const generateTraceId = () => `req_${Math.random().toString(36).slice(2, 12)}`;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('hospyn_access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  config.headers['X-Request-ID'] = generateTraceId();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    const normalized = {
      error_code: detail?.error_code || 'UNKNOWN_ERROR',
      message: detail?.message || error.message || 'An unexpected error occurred.',
      trace_id: detail?.trace_id || error.config?.headers?.['X-Request-ID'],
      status,
    };

    if (status === 401) {
      sessionStorage.removeItem('hospyn_access_token');
      sessionStorage.removeItem('hospyn_user');
      window.location.href = '/login';
    }

    return Promise.reject(normalized);
  }
);

export const authAPI = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { username: email, password }),
};

export const hospitalAPI = {
  create: (data: any, idempotencyKey: string) =>
    apiClient.post('/hospital/', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  addDepartment: (hospitalId: string, data: any) =>
    apiClient.post(`/hospital/${hospitalId}/departments`, data),
  get: (hospitalId: string) =>
    apiClient.get(`/hospital/${hospitalId}`),
};
