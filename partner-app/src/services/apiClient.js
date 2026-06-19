import axios from 'axios';
import { API_BASE_URL } from '../api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    }
});

let onAuthFailureCallback = null;

export const setAuthFailureCallback = (callback) => {
    onAuthFailureCallback = callback;
};

// Inject Auth Token
apiClient.interceptors.request.use((config) => {
    // EXECUTION FIX: was reading 'partner_token', but Login.jsx and
    // Dashboard.jsx both read/write 'token'. Every authenticated request was
    // silently sent with NO Authorization header at all (token was always
    // undefined under this key), so every call landed as 401 regardless of
    // whether login actually succeeded.
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Global Error Handler
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (axios.isCancel(error)) return Promise.reject(error);

        const { response } = error;
        
        if (response?.status === 401) {
            console.error("AUTH_FAILURE: Session expired.");
            localStorage.removeItem('token');
            if (onAuthFailureCallback) onAuthFailureCallback();
        }
        
        return Promise.reject(error);
    }
);

export default apiClient;
