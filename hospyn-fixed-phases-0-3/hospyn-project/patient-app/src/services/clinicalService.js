import apiClient from './apiClient';
import { API_BASE_URL } from '../api';
import { SecurityUtils } from '../utils/security';

// Zero-footprint ephemeral in-memory cache (HIPAA/GDPR compliance)
const ephemeralClinicalCache = new Map();

export const clinicalService = {
    getClinicalSummary: async (signal) => {
        const activeMemberId = await SecurityUtils.getActiveMemberId() || 'primary';
        const cacheKey = `${activeMemberId}_summary`;
        try {
            const response = await apiClient.get('/patient/clinical-summary', { signal });
            ephemeralClinicalCache.set(cacheKey, response.data);
            return response.data;
        } catch (e) {
            if (e.name === 'CanceledError' || e.name === 'AbortError') throw e;
            console.warn('[clinicalService] Failed to fetch clinical summary. Loading ephemeral in-memory cache...');
            const cached = ephemeralClinicalCache.get(cacheKey);
            if (cached) return cached;
            throw e;
        }
    },

    getTimeline: async (signal) => {
        const activeMemberId = await SecurityUtils.getActiveMemberId() || 'primary';
        const cacheKey = `${activeMemberId}_timeline`;
        try {
            const response = await apiClient.get('/clinical/timeline', { signal });
            ephemeralClinicalCache.set(cacheKey, response.data);
            return response.data;
        } catch (e) {
            if (e.name === 'CanceledError' || e.name === 'AbortError') throw e;
            console.warn('[clinicalService] Timeline offline mode. Loading ephemeral in-memory cache...');
            const cached = ephemeralClinicalCache.get(cacheKey);
            if (cached) return cached;
            throw e;
        }
    },

    getRecords: async (signal) => {
        const activeMemberId = await SecurityUtils.getActiveMemberId() || 'primary';
        const cacheKey = `${activeMemberId}_records`;
        try {
            const response = await apiClient.get('/patient/records', { signal });
            ephemeralClinicalCache.set(cacheKey, response.data);
            return response.data;
        } catch (e) {
            if (e.name === 'CanceledError' || e.name === 'AbortError') throw e;
            console.warn('[clinicalService] Records offline mode. Loading ephemeral in-memory cache...');
            const cached = ephemeralClinicalCache.get(cacheKey);
            if (cached) return cached;
            throw e;
        }
    },
    deleteRecord: async (recordId, password) => {
        const response = await apiClient.post(`/patient/records/${recordId}/delete`, { password });
        return response.data;
    },

    uploadReport: async (formData) => {
        // Native fetch for large blobs avoiding Axios serialization bugs
        const token = await SecurityUtils.getToken();
        const activeMemberId = await SecurityUtils.getActiveMemberId();
        const randomId = Math.random().toString(36).substring(2, 15);
        
        const headers = { 
            'Authorization': `Bearer ${token}`,
            'X-Idempotency-Key': `hospyn_upload_${Date.now()}_${randomId}`
        };
        if (activeMemberId) {
            headers['X-Family-Member-ID'] = activeMemberId;
        }

        const response = await fetch(`${API_BASE_URL}/patient/upload-report`, {
            method: 'POST',
            headers,
            body: formData,
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed with status ${response.status}`);
        }
        
        return await response.json();
    },

    confirmReport: async (data) => {
        const response = await apiClient.post('/patient/confirm-and-save-report', data);
        return response.data;
    },

    getPendingAccess: async (signal) => {
        const response = await apiClient.get('/patient/pending-access', { signal });
        return response.data;
    },

    approveAccess: async (accessId, data) => {
        const response = await apiClient.post(`/patient/approve-access/${accessId}`, data);
        return response.data;
    },

    revokeAccess: async (accessId) => {
        const response = await apiClient.post(`/patient/revoke-access/${accessId}`);
        return response.data;
    },

    logMedication: async (medicationId) => {
        const response = await apiClient.post(`/patient/log-medication?medication_id=${medicationId}`);
        return response.data;
    },

    scanHospitalQR: async (qrData) => {
        const response = await apiClient.post('/visit/scan', { qr_data: qrData });
        return response.data;
    },

    createVisit: async (hospital_id, reason, symptoms = '', dept = '', doctor = '') => {
        const response = await apiClient.post('/visit/create', { 
            hospital_id, 
            visit_reason: reason, 
            symptoms,
            department: dept,
            doctor_name: doctor
        });
        return response.data;
    },

    getAccessHistory: async (signal) => {
        const response = await apiClient.get('/patient/access-history', { signal });
        return response.data;
    },

    getVisits: async (signal) => {
        const response = await apiClient.get('/visit/my-visits', { signal });
        return response.data;
    },

    getPrescriptions: async (signal) => {
        const response = await apiClient.get('/clinical/prescriptions', { signal });
        return response.data;
    },

    getPrescriptionDetail: async (prescriptionId, signal) => {
        const response = await apiClient.get(`/clinical/prescriptions/${prescriptionId}`, { signal });
        return response.data;
    },

    getLabReports: async (signal) => {
        const response = await apiClient.get('/lab/reports', { signal });
        return response.data;
    },

    getLabReportDetail: async (orderId, signal) => {
        const response = await apiClient.get(`/lab/orders/${orderId}/results`, { signal });
        return response.data;
    },

    getLatestLabOrder: async (signal) => {
        const response = await apiClient.get('/referrals/patients/latest-lab-order', { signal });
        return response.data;
    },

    getLatestPrescription: async (signal) => {
        const response = await apiClient.get('/referrals/patients/latest-prescription', { signal });
        return response.data;
    },

    submitPartnerLabRequest: async (orderId, partnerHospitalId) => {
        const response = await apiClient.post('/referrals/labs/request', {
            order_id: orderId,
            partner_hospital_id: partnerHospitalId
        });
        return response.data;
    },

    submitPartnerPharmacyRequest: async (prescriptionId, partnerPharmacyId) => {
        const response = await apiClient.post('/referrals/pharmacies/request', {
            prescription_id: prescriptionId,
            partner_pharmacy_id: partnerPharmacyId
        });
        return response.data;
    },

    clearCache: () => {
        ephemeralClinicalCache.clear();
        console.log('[clinicalService] Ephemeral cache successfully purged.');
    }
};
