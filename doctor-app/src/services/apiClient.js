import axios from 'axios';
import { API_BASE_URL } from '../api';

// Create a centralized Axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000, // 10 second timeout for requests
    headers: {
        'Content-Type': 'application/json',
    },
});

// FIXED: same systemic bug as Staff Portal — healthcare-core mounts every
// route under /api/v1/healthcare/*, not directly under /api/v1/*. This app
// (and the doctor-app's other two API clients) called paths like
// /doctor/queue, /medicines/search, /prescriptions with no prefix at all.
const PASSTHROUGH_PREFIXES = ['/auth', '/ai', '/notifications', '/healthcare'];
function withHealthcarePrefix(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith('/') ? url : `/${url}`;
  if (PASSTHROUGH_PREFIXES.some((p) => normalized.startsWith(p))) return url;
  return `/healthcare${normalized}`;
}

// -----------------------------------------------------------------------------
// Request Interceptor
// -----------------------------------------------------------------------------
apiClient.interceptors.request.use(
    (config) => {
        // FIXED: was localStorage.getItem('token') — that key/storage is
        // never written anywhere consistent with the PHI policy (token
        // should not persist in localStorage); now reads sessionStorage
        // under the key LoginScreen.jsx actually writes to.
        const token = sessionStorage.getItem('hospain_access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        // FIXED ORDER: prefix rewrite must happen while the URL still has
        // its leading slash (withHealthcarePrefix's passthrough check
        // depends on it) — then strip the slash afterward as this file
        // already did for axios baseURL concatenation.
        config.url = withHealthcarePrefix(config.url);
        if (config.url && config.url.startsWith('/')) {
            config.url = config.url.substring(1);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// -----------------------------------------------------------------------------
// Response Interceptor
// -----------------------------------------------------------------------------
apiClient.interceptors.response.use(
    (response) => {
        return response.data; // Simplify response handling in components
    },
    (error) => {
        if (!error.response) {
            // Network error (e.g., server down or CORS failure)
            console.error('[API Network Error]', error);
            // Optionally, we could dispatch a custom event here for a global toast
            return Promise.reject(new Error('Network error. Please check your connection.'));
        }

        const { status, data } = error.response;

        switch (status) {
            case 401:
                // Unauthorized - Token expired or invalid
                console.warn('[API 401 Unauthorized] - Logging out...');
                sessionStorage.removeItem('hospain_access_token');
                // Redirect to login (doing it this way prevents cyclic imports with React Router)
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                break;
            case 429:
                // Too Many Requests - Rate Limiting Triggered
                console.warn('[API 429 Rate Limit]', data);
                // We will reject the promise with a specific message so the UI can handle it gracefully
                error.message = 'Too many requests. Please wait a moment and try again.';
                break;
            case 403:
                // Forbidden - RBAC Blocked
                console.warn('[API 403 Forbidden]', data);
                error.message = 'You do not have permission to perform this action.';
                break;
            case 500:
                // Internal Server Error
                console.error('[API 500 Internal Error]', data);
                error.message = 'An internal server error occurred. Our team has been notified.';
                break;
            default:
                // General fallback.
                // FIXED: healthcare-core/auth-service's error_response() helper
                // returns { success, error_code, message } — there is no
                // "detail" key on those responses. FastAPI's own validation
                // errors (422s) do use "detail". Check both so real backend
                // error messages ("Incorrect OTP. 4 attempt(s) remaining.",
                // etc.) actually reach the user instead of a generic string.
                if (Array.isArray(data?.detail)) {
                    error.message = data.detail.map(err => `${err.loc ? err.loc.join('.') : 'error'}: ${err.msg}`).join(', ');
                } else if (typeof data?.detail === 'object') {
                    error.message = JSON.stringify(data.detail);
                } else {
                    error.message = data?.detail || data?.message || 'An unexpected error occurred.';
                }
                break;
        }

        return Promise.reject(error);
    }
);

export default apiClient;
