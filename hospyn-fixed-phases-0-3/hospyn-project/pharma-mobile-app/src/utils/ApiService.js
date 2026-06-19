// pharma-mobile-app/src/utils/ApiService.js
// SEC-2 / SEC-9 FIX: Replaced hardcoded localhost URL with environment variable.
// Set EXPO_PUBLIC_API_BASE_URL in pharma-mobile-app/.env

import axios from "axios";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "EXPO_PUBLIC_API_BASE_URL is not set. " +
    "Add it to pharma-mobile-app/.env"
  );
}

const apiService = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiService;
