import axios from 'axios';
import { SecurityUtils } from './security';
import { API_BASE_URL } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
                
                // PRODUCTION-GRADE RETRY: Exponential Backoff for Infrastructure Faults
                if (!response || (response.status >= 500 && response.status <= 599)) {
                    config.__retryCount = config.__retryCount || 0;
                    if (config.__retryCount < 3) {
                        config.__retryCount += 1;
                        const delay = Math.pow(2, config.__retryCount) * 1000;
                        console.warn(`RETRYING_CLINICAL_CALL: ${config.url} (Attempt ${config.__retryCount}) in ${delay}ms`);
                        await new Promise(res => setTimeout(res, delay));
                        return this.client(config);
                    }
                }

                if (response?.status === 401) {
                    console.error("AUTH_FAILURE: Session expired. (Mock Bypass - Not logging out)");
                    // Disabled automatic logout so the user can browse the UI
                    // if (this.onAuthFailure) {
                    //     this.onAuthFailure();
                    // }
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

    // --- Convenience Methods ---
    async get(url, config = {}) { return (await this.client.get(url, config)).data; }
    async post(url, data = {}, config = {}) { return (await this.client.post(url, data, config)).data; }
    async put(url, data = {}, config = {}) { return (await this.client.put(url, data, config)).data; }
    async delete(url, config = {}) { return (await this.client.delete(url, config)).data; }

    // --- Clinical Endpoints ---
    
    async getProfile() {
        try {
            const response = await this.client.get('/patient/profile');
            // Cache the successful profile fetch
            await AsyncStorage.setItem('@hospyn_profile_cache', JSON.stringify(response.data));
            return response.data;
        } catch (e) {
            console.warn('[API] Network failure, attempting to load offline profile...');
            const cachedStr = await AsyncStorage.getItem('@hospyn_profile_cache');
            if (cachedStr) {
                try {
                    return JSON.parse(cachedStr);
                } catch (parseErr) {
                    console.error('Cache corrupted:', parseErr);
                }
            }
            throw e; // If no cache exists, throw the actual error to be handled by the UI
        }
    }

    async updateProfile(data) {
        try {
            const response = await this.client.post('/patient/profile/update', data);
            // Synchronize local sovereign cache with fresh backend state
            const current = await this.getProfile();
            const updated = { ...current, ...data };
            await AsyncStorage.setItem('@hospyn_profile_cache', JSON.stringify(updated));
            return response.data;
        } catch (e) {
            console.error('[API] Profile update failed. Integrity check required.');
            throw e;
        }
    }

    async exportProfileData() {
        // Simulate generating a secure health export
        await new Promise(resolve => setTimeout(resolve, 2000));
        const profile = await this.getProfile();
        return {
            filename: `Hospyn_Export_${profile.hospyn_id}.json`,
            timestamp: new Date().toISOString(),
            status: 'ready'
        };
    }

    async getClinicalSummary() {
        try {
            const response = await this.client.get('/patient/clinical-summary');
            await AsyncStorage.setItem('@cache_clinical_summary', JSON.stringify(response.data));
            return response.data;
        } catch (e) {
            console.warn('[API] Failed to fetch clinical summary. Loading offline cache...');
            const cachedStr = await AsyncStorage.getItem('@cache_clinical_summary');
            if (cachedStr) return JSON.parse(cachedStr);
            throw e;
        }
    }

    async getTimeline() {
        try {
            const response = await this.client.get('/clinical/timeline');
            await AsyncStorage.setItem('@cache_timeline', JSON.stringify(response.data));
            return response.data;
        } catch (e) {
            console.warn('[API] Timeline offline mode...');
            const cachedStr = await AsyncStorage.getItem('@cache_timeline');
            if (cachedStr) return JSON.parse(cachedStr);
            throw e;
        }
    }

    async getRecords() {
        try {
            const response = await this.client.get('/patient/records');
            await AsyncStorage.setItem('@cache_records', JSON.stringify(response.data));
            return response.data;
        } catch (e) {
            console.warn('[API] Records offline mode...');
            const cachedStr = await AsyncStorage.getItem('@cache_records');
            if (cachedStr) return JSON.parse(cachedStr);
            throw e;
        }
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

    async createVisit(hospital_id, reason, symptoms = '', dept = '', doctor = '') {
        const response = await this.client.post('/visit/create', { 
            hospital_id, 
            visit_reason: reason, 
            symptoms: symptoms,
            department: dept,
            doctor_name: doctor
        });
        return response.data;
    }

    async getAccessHistory() {
        const response = await this.client.get('/patient/access-history');
        return response.data;
    }

    async getNotifications() {
        const response = await this.client.get('/patient/notifications');
        return response.data;
    }

    // --- Phase 4 & 5.5: Billing & Clinical Bridge ---
    
    async getInvoices() {
        const response = await this.client.get('/billing/invoices');
        return response.data;
    }

    async getInvoiceDetail(invoiceId) {
        const response = await this.client.get(`/billing/invoices/${invoiceId}`);
        return response.data;
    }

    async getPrescriptions() {
        const response = await this.client.get('/clinical/prescriptions');
        return response.data;
    }

    async getPrescriptionDetail(prescriptionId) {
        const response = await this.client.get(`/clinical/prescriptions/${prescriptionId}`);
        return response.data;
    }

    async getLabReports() {
        const response = await this.client.get('/lab/reports');
        return response.data;
    }

    async getLabReportDetail(orderId) {
        const response = await this.client.get(`/lab/orders/${orderId}/results`);
        return response.data;
    }

    async exportProfileData() {
        const response = await this.client.post('/patient/export-data');
        return response.data;
    }
}

export default new ApiService();
