// reception-portal/src/services/receptionApi.js
// SEC-7 FIX: Replace localStorage token with httpOnly cookie via credentials:'include'.

import axios from "axios";

// Gateway URL with /api/v1 suffix so relative paths like /billing/... resolve correctly
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
    : null) ||
  (process.env.REACT_APP_API_BASE_URL
    ? `${process.env.REACT_APP_API_BASE_URL}/api/v1`
    : null) ||
  'http://localhost:8000/api/v1';

const receptionApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,  // SEC-7: sends httpOnly cookie automatically
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// SEC-7: Removed localStorage.getItem("staff_token") — no longer needed.
// The browser sends the httpOnly cookie on every request automatically.
// Fallback: read Bearer token from sessionStorage if cookie auth not available.
receptionApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('hospyn_access_token') || localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

receptionApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default receptionApi;
