/// <reference types="vite/client" />
import axios from 'axios';

// Read from VITE_API_BASE_URL (dev .env) or VITE_API_URL, fall back to localhost gateway
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
    : null) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('hospyn_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('hospyn_access_token');
      sessionStorage.removeItem('hospyn_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
