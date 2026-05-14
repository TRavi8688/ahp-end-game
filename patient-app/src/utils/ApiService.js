import axios from 'axios';
import { SecurityUtils } from './security';
import { API_BASE_URL } from '../api';

/**
 * Hospyn 2.0 Enterprise API Service (Patient App)
 * Centralized handler for all production clinical endpoints.
 */
class ApiService {
    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
            }
        });

        // Inject Auth Token and Security Headers automatically
        this.client.interceptors.request.use(async (config) => {
            const token = await SecurityUtils.getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            const activeMemberId = await SecurityUtils.getActiveMemberId();
            if (activeMemberId) {
                config.headers['X-Family-Member-ID'] = activeMemberId;
            }

            // --- PRODUCTION DATA INTEGRITY ---
            // Automatically generate a unique key for every mutating operation
            // This satisfies the IdempotencyMiddleware for life.
            if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
                const randomId = Math.random().toString(36).substring(2, 15);
                const timestamp = Date.now();
                config.headers['X-Idempotency-Key'] = `hospyn_${timestamp}_${randomId}`;
            }

            return config;
        });

        this.onAuthFailure = null;

        // Global Error Handler with Retry Logic
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                const { config, response } = error;
                
                // Exponential Backoff Retry (for 5xx or Network Errors)
                if (!response || (response.status >= 500 && response.status <= 599)) {
                    config.__retryCount = config.__retryCount || 0;
                    if (config.__retryCount < 3) {
                        config.__retryCount += 1;
                        const delay = Math.pow(2, config.__retryCount) * 1000;
                        console.warn(`RETRYING_API_CALL: ${config.url} (Attempt ${config.__retryCount}) in ${delay}ms`);
                        await new Promise(res => setTimeout(res, delay));
                        return this.client(config);
                    }
                }

                if (response?.status === 401) {
                    console.error("AUTH_FAILURE: Session expired.");
                    if (this.onAuthFailure) {
                        this.onAuthFailure();
                    }
                    // Prevent further retries on auth failure
                    return Promise.reject(error);
                }
                return Promise.reject(error);
            }
        );
    }

    setAuthFailureCallback(callback) {
        this.onAuthFailure = callback;
    }

    // --- Clinical Endpoints ---
    
    async getProfile() {
        const response = await this.client.get('/patient/profile');
        return response.data;
    }

    async getClinicalSummary() {
        const response = await this.client.get('/patient/clinical-summary');
        return response.data;
    }

    async getTimeline() {
        const response = await this.client.get('/clinical/timeline');
        return response.data;
    }

    async getRecords() {
        const response = await this.client.get('/patient/records');
        return response.data;
    }

    async uploadReport(formData) {
        // Use native fetch for large files/blobs to avoid axios serialization issues on some platforms
        const token = await SecurityUtils.getToken();
        const randomId = Math.random().toString(36).substring(2, 15);
        
        const response = await fetch(`${API_BASE_URL}/patient/upload-report`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'X-Idempotency-Key': `hospyn_upload_${Date.now()}_${randomId}`
            },
            body: formData,
        });
        return await response.json();
    }

    async confirmReport(data) {
        const response = await this.client.post('/patient/confirm-and-save-report', data);
        return response.data;
    }

    // --- Access Control ---

    async getPendingAccess() {
        const response = await this.client.get('/patient/pending-access');
        return response.data;
    }

    async approveAccess(accessId) {
        const response = await this.client.post(`/patient/approve-access/${accessId}`);
        return response.data;
    }

    async revokeAccess(accessId) {
        const response = await this.client.post(`/patient/revoke-access/${accessId}`);
        return response.data;
    }

    async logMedication(medicationId) {
        const response = await this.client.post(`/patient/log-medication?medication_id=${medicationId}`);
        return response.data;
    }

    // --- Hospital Visit Endpoints ---
    async scanHospitalQR(qrData) {
        const response = await this.client.post('/visit/scan', { qr_data: qrData });
        return response.data;
    }

    async createVisit(hospitalId, reason, symptoms = '', dept = '', doctor = '') {
        const response = await this.client.post('/visit/create', { 
            hospital_id: hospitalId, 
            visit_reason: reason, 
            symptoms: symptoms,
            department: dept,
            doctor_name: doctor
        });
        return response.data;
    }
}

export default new ApiService();
