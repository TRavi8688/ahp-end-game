import axios from 'axios';
import { API_BASE_URL } from './api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

apiClient.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && (error.response.status === 401 || error.response.status === 403)) {
    // Check if the user is a doctor trying to access ERP endpoints
    const detail = error.response.data?.detail;
    if (detail && typeof detail === 'string' && detail.includes('Doctor')) {
        // Do not force logout, just let the component handle the specific message
    } else {
        // Standard token expiry or unauthorized access
        localStorage.removeItem('token');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});

export default apiClient;
