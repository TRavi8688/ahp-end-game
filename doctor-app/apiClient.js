/**
 * doctor-app/src/services/apiClient.js
 *
 * PHASE 2 FIX:
 *  - Removed localStorage.getItem('token') — XSS vulnerability
 *  - Added credentials: 'include' so httpOnly cookies are sent automatically
 *  - API base URL now reads from VITE_API_BASE_URL env var (no hardcode)
 *  - Preserved all existing error handling and interceptors
 *
 * The backend /auth/login must set the JWT as an httpOnly cookie.
 * In the auth service router.py login endpoint, add:
 *   response.set_cookie(
 *     key="access_token",
 *     value=access_token,
 *     httponly=True,
 *     secure=True,        # HTTPS only in production
 *     samesite="strict",
 *     max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
 *   )
 */

import axios from 'axios';

// ── Read API base URL from Vite environment variable ──────────────────────────
// In development: set VITE_API_BASE_URL=http://localhost:8001 in doctor-app/.env
// In production:  set VITE_API_BASE_URL=https://api.hospyn.com in doctor-app/.env.production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

const apiClient = axios.create({
    baseURL: `${API_BASE_URL}/api/v1`,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
    // ── SECURITY FIX: send httpOnly cookies automatically ─────────────────
    // This replaces localStorage token storage.
    // The access_token cookie is httpOnly — JS cannot read or steal it.
    withCredentials: true,
});

// ── Request Interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use(
    (config) => {
        // DO NOT read token from localStorage — that was XSS-vulnerable.
        // With withCredentials: true, the browser automatically sends the
        // httpOnly access_token cookie. Nothing extra needed here.
        if (config.url && config.url.startsWith('/')) {
            config.url = config.url.substring(1);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response Interceptor ─────────────────────────────────────────────────────
apiClient.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (!error.response) {
            console.error('[API Network Error]', error.message);
            return Promise.reject(new Error('Network error. Please check your connection.'));
        }

        const { status, data } = error.response;

        switch (status) {
            case 401:
                console.warn('[API 401 Unauthorized] — Session expired or invalid');
                // Clear any lingering localStorage tokens (migration cleanup)
                localStorage.removeItem('token');
                localStorage.removeItem('hospyn_token');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                break;
            case 429:
                console.warn('[API 429 Rate Limit]', data);
                error.message = 'Too many requests. Please wait a moment and try again.';
                break;
            case 403:
                console.warn('[API 403 Forbidden]', data);
                error.message = data?.detail || 'You do not have permission to perform this action.';
                break;
            case 500:
                console.error('[API 500 Internal Error]', data);
                error.message = 'An internal server error occurred.';
                break;
            default:
                if (Array.isArray(data?.detail)) {
                    error.message = data.detail.map(err => `${err.loc ? err.loc.join('.') : 'error'}: ${err.msg}`).join(', ');
                } else if (typeof data?.detail === 'object') {
                    error.message = JSON.stringify(data.detail);
                } else {
                    error.message = data?.detail || data?.message || 'An unexpected error occurred.';
                }
        }

        return Promise.reject(error);
    }
);

export default apiClient;
export { API_BASE_URL };
