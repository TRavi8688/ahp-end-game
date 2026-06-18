// src/services/apiClient.js
// Axios instance with auto token injection and 401 logout handling

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.hospyn.in';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('hospyn_partner_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 clear session and redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hospyn_partner_token');
      localStorage.removeItem('hospyn_partner_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
