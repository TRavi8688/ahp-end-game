/**
 * patient-app/src/services/apiClient.js
 *
 * PHASE 1.1 FIX:
 *  - API base URL now reads from EXPO_PUBLIC_API_BASE_URL env variable
 *  - Graceful error if env var is missing (clear message instead of crash)
 *  - Preserved abort signal support for cancellation
 *  - Token stored in SecureStore (Expo) — not localStorage
 */

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ── Read API URL from Expo environment ────────────────────────────────────────
// Set EXPO_PUBLIC_API_BASE_URL in patient-app/.env for development
// Set EXPO_PUBLIC_API_BASE_URL in patient-app/.env.production for production builds
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL
    || Constants.expoConfig?.extra?.apiBaseUrl
    || 'http://localhost:8001';

if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
    console.warn(
        '[apiClient] EXPO_PUBLIC_API_BASE_URL is not set. ' +
        'Create patient-app/.env with EXPO_PUBLIC_API_BASE_URL=http://localhost:8001'
    );
}

const TOKEN_KEY = 'hospyn_access_token';
const REFRESH_KEY = 'hospyn_refresh_token';

// ── Token storage using Expo SecureStore (encrypted on device) ────────────────
export const tokenStorage = {
    getToken: async () => {
        try {
            return await SecureStore.getItemAsync(TOKEN_KEY);
        } catch {
            return null;
        }
    },
    setToken: async (token) => {
        try {
            await SecureStore.setItemAsync(TOKEN_KEY, token);
        } catch (e) {
            console.error('[tokenStorage] Failed to store token:', e);
        }
    },
    getRefreshToken: async () => {
        try {
            return await SecureStore.getItemAsync(REFRESH_KEY);
        } catch {
            return null;
        }
    },
    setRefreshToken: async (token) => {
        try {
            await SecureStore.setItemAsync(REFRESH_KEY, token);
        } catch (e) {
            console.error('[tokenStorage] Failed to store refresh token:', e);
        }
    },
    clearAll: async () => {
        try {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await SecureStore.deleteItemAsync(REFRESH_KEY);
        } catch {
            // ignore
        }
    },
};

// ── Core fetch wrapper ────────────────────────────────────────────────────────
const apiClient = {
    _buildHeaders: async (extra = {}) => {
        const token = await tokenStorage.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...extra,
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    _handleResponse: async (response) => {
        if (response.status === 401) {
            // Try refresh
            const refreshed = await apiClient._tryRefresh();
            if (!refreshed) {
                await tokenStorage.clearAll();
                throw Object.assign(new Error('Session expired. Please log in again.'), { status: 401 });
            }
            throw Object.assign(new Error('TOKEN_REFRESHED'), { status: 401, retryable: true });
        }
        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json();
            } catch {
                // ignore
            }
            throw Object.assign(
                new Error(errorData.detail || errorData.message || `Request failed: ${response.status}`),
                { status: response.status, data: errorData }
            );
        }
        return response.json();
    },

    _tryRefresh: async () => {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) return false;
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (!res.ok) return false;
            const data = await res.json();
            const newToken = data?.data?.access_token || data?.access_token;
            if (newToken) {
                await tokenStorage.setToken(newToken);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    },

    get: async (path, options = {}) => {
        const { signal, params } = options;
        let url = `${API_BASE_URL}/api/v1${path}`;
        if (params) {
            const qs = new URLSearchParams(params).toString();
            url += `?${qs}`;
        }
        const headers = await apiClient._buildHeaders();
        const response = await fetch(url, { method: 'GET', headers, signal });
        return { data: await apiClient._handleResponse(response) };
    },

    post: async (path, body, options = {}) => {
        const { signal } = options;
        const url = `${API_BASE_URL}/api/v1${path}`;
        const headers = await apiClient._buildHeaders();
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal,
        });
        return { data: await apiClient._handleResponse(response) };
    },

    patch: async (path, body, options = {}) => {
        const url = `${API_BASE_URL}/api/v1${path}`;
        const headers = await apiClient._buildHeaders();
        const response = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body),
        });
        return { data: await apiClient._handleResponse(response) };
    },

    delete: async (path) => {
        const url = `${API_BASE_URL}/api/v1${path}`;
        const headers = await apiClient._buildHeaders();
        const response = await fetch(url, { method: 'DELETE', headers });
        return { data: await apiClient._handleResponse(response) };
    },
};

export default apiClient;
export { API_BASE_URL };
