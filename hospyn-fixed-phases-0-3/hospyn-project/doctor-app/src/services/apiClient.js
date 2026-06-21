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

// -----------------------------------------------------------------------------
// Request Interceptor
// -----------------------------------------------------------------------------
apiClient.interceptors.request.use(
    (config) => {
        // Automatically attach the Authorization token if it exists
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
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
                localStorage.removeItem('token');
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
                // General fallback
                error.message = data?.detail || 'An unexpected error occurred.';
                break;
        }

        return Promise.reject(error);
    }
);

export default apiClient;
