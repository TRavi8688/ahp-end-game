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

    // --- Clinical Endpoints ---
    
    async getProfile() {
        try {
            const response = await this.client.get('/patient/profile');
            return response.data;
        } catch (e) {
            // ONLY ALLOW MOCKS IN DEVELOPMENT
            if (__DEV__) {
                console.warn('DEV_MOCK: Falling back to local profile due to API failure.');
            
            // Load dynamic mock data from registration form to fix "Test User" bug
            const savedMockStr = await AsyncStorage.getItem('mock_profile');
            if (savedMockStr) {
                try {
                    const savedMock = JSON.parse(savedMockStr);
                    if (savedMock && savedMock.full_name) {
                        return savedMock;
                    }
                } catch (parseErr) {}
            }

            let mockId = await SecurityUtils.getHospynId();
            if (!mockId || mockId === 'Hospyn-Test') {
                const randomNum = Math.floor(100000 + Math.random() * 900000);
                mockId = `HOSPYN-${randomNum}`;
                await SecurityUtils.saveHospynId(mockId);
            }
                return { 
                    full_name: "Patient Name", 
                    hospyn_id: mockId, 
                    phone_number: mockId.includes('HOSPYN') ? "+91 9999999999" : mockId, 
                    blood_group: "N/A" 
                };
            }
            throw e; // Fail-Safe in Production
        }
    }

    async updateProfile(data) {
        try {
            const response = await this.client.post('/patient/profile/update', data);
            // After successful API update, also update our local cache
            const current = await this.getProfile();
            const updated = { ...current, ...data };
            await AsyncStorage.setItem('mock_profile', JSON.stringify(updated));
            return response.data;
        } catch (e) {
            if (__DEV__) {
                console.warn('DEV_MOCK: Mocking updateProfile');
                const current = await this.getProfile();
                const updated = { ...current, ...data };
                await AsyncStorage.setItem('mock_profile', JSON.stringify(updated));
                return updated;
            }
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
            return response.data;
        } catch (e) {
            if (__DEV__) return { metrics: [], recent_vitals: {} };
            throw e;
        }
    }

    async getTimeline() {
        try {
            const response = await this.client.get('/clinical/timeline');
            return response.data;
        } catch (e) {
            if (__DEV__) return { events: [] };
            throw e;
        }
    }

    async getRecords() {
        try {
            const response = await this.client.get('/patient/records');
            return response.data;
        } catch (e) {
            if (__DEV__) return { records: [] };
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
}

export default new ApiService();
