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
    const token = localStorage.getItem('partner_token');
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
            localStorage.removeItem('partner_token');
            if (onAuthFailureCallback) onAuthFailureCallback();
        }
        
        return Promise.reject(error);
    }
);

export default apiClient;
