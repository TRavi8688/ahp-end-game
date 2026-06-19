/**
 * src/services/apiClient.js
 *
 * FIX 1: baseURL was set to API_BASE_URL which includes /api/v1 suffix.
 *         Then every service call ALSO had /api/v1/healthcare/... in the path.
 *         This caused double-prefix: http://host/api/v1/api/v1/healthcare/...
 *         FIX: Set baseURL to the root (no /api/v1 suffix) so service paths
 *         like /api/v1/healthcare/patients/profile resolve correctly.
 *
 * FIX 2: Added silent token refresh on 401 using refresh token before logout.
 *         Previously any 401 immediately logged the user out.
 *
 * FIX 3: Added X-Request-ID header for backend tracing.
 */

import axios from 'axios';
import { SecurityUtils } from '../utils/security';

// Root URL — NO /api/v1 suffix (service calls include full path)
const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL
    ? process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/api\/v1\/?$/, '')
    : 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let onAuthFailureCallback = null;
let isRefreshing = false;
let refreshQueue = [];

export const setAuthFailureCallback = (callback) => {
  onAuthFailureCallback = callback;
};

// ── Request interceptor ───────────────────────────────────────────────────────
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecurityUtils.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const activeMemberId = await SecurityUtils.getActiveMemberId();
    if (activeMemberId) config.headers['X-Family-Member-ID'] = activeMemberId;
  } catch (e) {
    console.warn('[apiClient] Failed to attach auth headers:', e.message);
  }

  // Idempotency key for mutation requests
  if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
    config.headers['X-Idempotency-Key'] =
      `hospyn_pt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  // Request trace ID
  config.headers['X-Request-ID'] =
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);

    const { config, response } = error;

    // 500-599: exponential backoff retry (max 3)
    if (response?.status >= 500 && config) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < 3) {
        config.__retryCount += 1;
        const delay = Math.pow(2, config.__retryCount) * 1000;
        await new Promise(res => setTimeout(res, delay));
        return apiClient(config);
      }
    }

    // 401: try silent token refresh first
    if (response?.status === 401 && !config._retry) {
      config._retry = true;

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject, config });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = await SecurityUtils.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const { authService } = require('./authService');
        const data = await authService.refreshToken(refreshToken);

        await SecurityUtils.saveToken(data.access_token);
        if (data.refresh_token) await SecurityUtils.saveRefreshToken(data.refresh_token);

        // Retry queued requests
        refreshQueue.forEach(({ resolve, config: qConfig }) => {
          qConfig.headers.Authorization = `Bearer ${data.access_token}`;
          resolve(apiClient(qConfig));
        });
        refreshQueue = [];

        // Retry original request with new token
        config.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(config);
      } catch (refreshErr) {
        refreshQueue.forEach(({ reject }) => reject(refreshErr));
        refreshQueue = [];
        await SecurityUtils.deleteToken();
        if (onAuthFailureCallback) onAuthFailureCallback();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    if (response?.status === 429) {
      console.warn('[apiClient] Rate limited — backing off.');
    }

    return Promise.reject(error);
  }
);

export default apiClient;
