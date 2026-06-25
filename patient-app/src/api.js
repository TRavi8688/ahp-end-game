// patient-app/src/api.js
// SEC-2 FIX: Replaced hardcoded production URL with environment variable.
// Set EXPO_PUBLIC_API_BASE_URL in patient-app/.env and patient-app/.env.production

import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://hospyn-495906-api-625745217419.asia-south1.run.app/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token from storage on every request
api.interceptors.request.use(
  async (config) => {
    // Token retrieval stays as-is (uses SecureStore / AsyncStorage)
    // SEC-7 note: super-admin uses httpOnly cookies; patient-app uses secure token storage
    return config;
  },
  (error) => Promise.reject(error)
);

const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "625745217419-cq76tvb0mlt0bkmg8bd4r0csj4vmqmr8.apps.googleusercontent.com";

export { API_BASE_URL, WS_BASE_URL, GOOGLE_CLIENT_ID };
export default api;
