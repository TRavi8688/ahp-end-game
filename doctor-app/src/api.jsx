// doctor-app/src/api.jsx
// SEC-2 FIX: Replaced hardcoded production URL with Vite env variable.
// Set VITE_API_BASE_URL in doctor-app/.env

import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_BASE_URL is not set. " +
    "Add it to doctor-app/.env"
  );
}

export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace(/^http/, 'ws');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
