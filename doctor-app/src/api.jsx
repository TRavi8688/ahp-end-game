// doctor-app/src/api.jsx
//
// FIX: Removed the throw new Error() when VITE_API_BASE_URL is not set.
// The original code white-screened the entire app if .env was missing.
// Now falls back gracefully to localhost for development.
//
// FIX: WS_BASE_URL now auto-derives from API_BASE_URL if not explicitly set.

import axios from "axios";

// ── API Base URL ──────────────────────────────────────────────────────────────
// Priority: VITE_API_BASE_URL env var → localhost fallback
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api/v1";

// ── WebSocket URL ─────────────────────────────────────────────────────────────
// Auto-derives wss:// from https:// API URL if VITE_WS_BASE_URL not set
export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ||
  API_BASE_URL
    .replace(/\/api\/v1\/?$/, "")
    .replace(/^https/, "wss")
    .replace(/^http/, "ws");

if (import.meta.env.DEV) {
  console.log("[Doctor App] API:", API_BASE_URL);
  console.log("[Doctor App] WS:", WS_BASE_URL);
}

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor: attach JWT token ────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle auth failures ────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
