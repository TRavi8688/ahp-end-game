// patient-app/src/api.js
// SEC-2 FIX: Replaced hardcoded production URL with environment variable.
// Set EXPO_PUBLIC_API_BASE_URL in patient-app/.env and patient-app/.env.production

import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://hospyn-495906-api-625745217419.asia-south1.run.app/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token from storage on every request
import { SecurityUtils } from "./utils/security";

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecurityUtils.getToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Storage read failed — let the request go out unauthenticated;
      // the backend will 401 it and the app's normal auth-failure
      // handling (apiClient.js's response interceptor) takes over.
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "625745217419-cq76tvb0mlt0bkmg8bd4r0csj4vmqmr8.apps.googleusercontent.com";

export { API_BASE_URL, WS_BASE_URL, GOOGLE_CLIENT_ID };
export default api;
