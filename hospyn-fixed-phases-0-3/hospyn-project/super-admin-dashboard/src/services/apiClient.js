// super-admin-dashboard/src/services/apiClient.js
// SEC-7 FIX: Use credentials:'include' so the httpOnly cookie is sent automatically.
// Remove ALL localStorage.getItem('token') calls across super-admin pages.

import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,  // SEC-7: sends the httpOnly cookie automatically
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// No Authorization header manipulation needed — cookie is sent by the browser.
// Remove any interceptor that reads localStorage.getItem('token').

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login on auth failure
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
