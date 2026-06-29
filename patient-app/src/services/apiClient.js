import axios from 'axios';
import { SecurityUtils } from '../utils/security';
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

// Inject Auth Token and Security Headers automatically
apiClient.interceptors.request.use(async (config) => {
    try {
        const token = await SecurityUtils.getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const activeMemberId = await SecurityUtils.getActiveMemberId();
        if (activeMemberId) {
            config.headers['X-Family-Member-ID'] = activeMemberId;
        }
    } catch (e) {
        console.warn("Failed to attach security headers", e);
    }

    // --- PRODUCTION DATA INTEGRITY ---
    // Automatically generate a unique key for every mutating operation
    if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
        const randomId = Math.random().toString(36).substring(2, 15);
        const timestamp = Date.now();
        config.headers['X-Idempotency-Key'] = `hospyn_pt_${timestamp}_${randomId}`;
    }

    return config;
});

// Global Error Handler with Retry Logic
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        // If request was canceled via AbortController, just throw it silently
        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }

        const { config, response } = error;
        
        // PRODUCTION-GRADE RETRY: Exponential Backoff for Infrastructure Faults
        if (response && response.status >= 500 && response.status <= 599 && config) {
            config.__retryCount = config.__retryCount || 0;
            if (config.__retryCount < 3) {
                config.__retryCount += 1;
                const delay = Math.pow(2, config.__retryCount) * 1000;
                console.warn(`RETRYING_CLINICAL_CALL: ${config.url} (Attempt ${config.__retryCount}) in ${delay}ms`);
                await new Promise(res => setTimeout(res, delay));
                return apiClient(config);
            }
        }

        if (response?.status === 401) {
            console.error("AUTH_FAILURE: Session expired. Clearing token.");
            SecurityUtils.deleteToken();
            if (onAuthFailureCallback) {
                onAuthFailureCallback();
            }
            return Promise.reject(error);
        }
        
        if (response?.status === 429) {
            console.warn("RATE_LIMIT: Too many requests sent to Hospain.");
        }

        return Promise.reject(error);
    }
);

export default apiClient;
