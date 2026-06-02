// patient-app/src/api.js
// SEC-2 FIX: Replaced hardcoded production URL with environment variable.
// Set EXPO_PUBLIC_API_BASE_URL in patient-app/.env and patient-app/.env.production

import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "EXPO_PUBLIC_API_BASE_URL is not set. " +
    "Add it to patient-app/.env (development) and patient-app/.env.production (production)."
  );
}

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

export default api;
