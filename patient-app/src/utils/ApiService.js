import axios from 'axios';
import { SecurityUtils } from './security';
import { API_BASE_URL } from '../api';

// SECURITY HARDENING: Removed AsyncStorage for clinical data caching.
// Storing sensitive medical records in unencrypted local storage is a critical security vulnerability.
// We now use an ephemeral in-memory session cache that dies when the app closes.
const SessionMemoryCache = new Map();

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
                if (response && response.status >= 500 && response.status <= 599) {
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
                    console.error("AUTH_FAILURE: Session expired. Clearing token.");
                    // Clear stored token to force re-authentication
                    SecurityUtils.deleteToken();
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

    // --- Convenience Methods ---
    async get(url, config = {}) { return (await this.client.get(url, config)).data; }
    async post(url, data = {}, config = {}) { return (await this.client.post(url, data, config)).data; }
    async put(url, data = {}, config = {}) { return (await this.client.put(url, data, config)).data; }
    async delete(url, config = {}) { return (await this.client.delete(url, config)).data; }

    // --- Clinical Endpoints ---
    
    async getProfile() {
        try {
            const response = await this.client.get('/patient/profile');
            const profile = response.data?.patient || response.data?.data || response.data;
            if (profile && profile.phone && !profile.phone_number) {
                profile.phone_number = profile.phone;
            }
            SessionMemoryCache.set('@hospyn_profile_cache', profile);
            return profile;
        } catch (e) {
            console.warn('[API] Network failure, attempting to load session profile...');
            const cachedData = SessionMemoryCache.get('@hospyn_profile_cache');
            if (cachedData) {
                return cachedData;
            }
            throw e; // If no cache exists, throw the actual error to be handled by the UI
        }
    }

    async updateProfile(data) {
        try {
            const cached = SessionMemoryCache.get('@hospyn_profile_cache');
            const patientId = data.id || cached?.id;
            if (!patientId) {
                throw new Error('Cannot update profile: missing patient id. Reload your profile first.');
            }
            if (data.phone_number) {
                data.phone = data.phone_number;
            }
            const response = await this.client.put(`/patients/${patientId}`, data);
            const updatedFromServer = response.data?.data || response.data;
            const current = cached || {};
            const updated = { ...current, ...updatedFromServer };
            if (updated.phone && !updated.phone_number) {
                updated.phone_number = updated.phone;
            }
            SessionMemoryCache.set('@hospyn_profile_cache', updated);
            return updated;
        } catch (e) {
            console.error('[API] Profile update failed. Integrity check required.');
            throw e;
        }
    }

    async deleteAccount() {
        const cached = SessionMemoryCache.get('@hospyn_profile_cache');
        const patientId = cached?.id;
        if (!patientId) {
            throw new Error('Cannot delete account: missing patient id.');
        }
        const response = await this.client.delete(`/patients/${patientId}`);
        return response.data;
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
            SessionMemoryCache.set('@cache_clinical_summary', response.data);
            return response.data;
        } catch (e) {
            console.warn('[API] Failed to fetch clinical summary. Loading session cache...');
            const cachedData = SessionMemoryCache.get('@cache_clinical_summary');
            if (cachedData) return cachedData;
            throw e;
        }
    }

    async getTimeline() {
        try {
            const response = await this.client.get('/clinical/timeline');
            SessionMemoryCache.set('@cache_timeline', response.data);
            return response.data;
        } catch (e) {
            console.warn('[API] Timeline offline mode...');
            const cachedData = SessionMemoryCache.get('@cache_timeline');
            if (cachedData) return cachedData;
            throw e;
        }
    }

    async getRecords() {
        try {
            const response = await this.client.get('/patient/records');
            SessionMemoryCache.set('@cache_records', response.data);
            return response.data;
        } catch (e) {
            console.warn('[API] Records offline mode...');
            const cachedData = SessionMemoryCache.get('@cache_records');
            if (cachedData) return cachedData;
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
        return []; // The backend does not have a pending access requests queue; sharing is instant via QR code scan.
    }

    async approveAccess(accessId) {
        return { success: true };
    }

    async revokeAccess(accessId) {
        const response = await this.client.delete(`/patient/revoke-access/${accessId}`);
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
        return []; // The backend does not implement patient-side access history audit logs yet.
    }

    async getNotifications() {
        const response = await this.client.get('/patient/notifications');
        return response.data;
    }

    // --- Partner Referral Network ---
    async getLatestLabOrder() {
        const response = await this.client.get('/referrals/patients/latest-lab-order');
        return response.data;
    }

    async getLatestPrescription() {
        const response = await this.client.get('/referrals/patients/latest-prescription');
        return response.data;
    }

    async submitPartnerLabRequest(orderId, partnerHospitalId) {
        const response = await this.client.post('/referrals/labs/request', {
            order_id: orderId,
            partner_hospital_id: partnerHospitalId
        });
        return response.data;
    }

    async submitPartnerPharmacyRequest(prescriptionId, partnerPharmacyId) {
        const response = await this.client.post('/referrals/pharmacies/request', {
            prescription_id: prescriptionId,
            partner_pharmacy_id: partnerPharmacyId
        });
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
}

export default new ApiService();
