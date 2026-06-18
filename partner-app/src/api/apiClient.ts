// partner-app/src/api/apiClient.ts
//
// FIX: Changed localStorage key from "partner_token" to "partner_access_token"
// to match what the Redux authSlice and services/apiClient.js both write.
// Before this fix, the token was written under one key and read under another,
// so Authorization headers were always empty after login.

import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://hospyn-495906-api-625745217419.us-central1.run.app";

let authFailureCallback: (() => void) | null = null;

export function setAuthFailureCallback(cb: () => void) {
  authFailureCallback = cb;
}

const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// ── Request interceptor: inject Bearer token ──────────────────────────────────
apiClient.interceptors.request.use((config) => {
  // FIX: Use "partner_access_token" to match authSlice + services/apiClient.js
  const token = localStorage.getItem("partner_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: handle 401 ─────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("partner_access_token");
      localStorage.removeItem("partner_refresh_token");
      if (authFailureCallback) {
        authFailureCallback();
      } else {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
