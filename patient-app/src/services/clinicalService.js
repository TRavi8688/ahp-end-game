import apiClient from './apiClient';
import { API_BASE_URL } from '../api';
import { SecurityUtils } from '../utils/security';

// Zero-footprint ephemeral in-memory cache (HIPAA/GDPR compliance)
const ephemeralClinicalCache = new Map();

// Some backend features used by this app's screens genuinely don't exist
// yet (confirmed by checking the actual backend routes, not assumed) —
// calling them throws a clear error instead of silently 404ing or pretending
// to work. See the per-method notes below for what's missing and why.
function notBuiltYet(featureName) {
    return Promise.reject(new Error(
        `${featureName} isn't available yet — this feature needs backend work that hasn't been built. ` +
        `(Confirmed: no matching route exists in healthcare-core.)`
    ));
}

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

    // NOT BUILT YET: there is no per-record delete endpoint anywhere in the
    // backend (patients.py only has DELETE /{patient_id}, which deletes the
    // whole patient — not a single record). Needs real backend work before
    // this can be wired up; not faking it here.
    deleteRecord: async (_recordId, _password) => notBuiltYet('Deleting a record'),

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

        // BUG FIX: was /patient/upload-report — the real endpoint lives on
        // the top-level patients router (plural): /patients/upload-report.
        const response = await fetch(`${API_BASE_URL}/patients/upload-report`, {
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
        // BUG FIX: was /patient/confirm-and-save-report — the real endpoint
        // is on the top-level patients router (plural): /patients/confirm-and-save-report.
        const response = await apiClient.post('/patients/confirm-and-save-report', data);
        return response.data;
    },

    // NOT BUILT YET: patient_mobile_api.py only has GET /patient/active-sharing
    // (who currently has access) — there's no separate "incoming access
    // requests awaiting my approval" concept/endpoint on the backend.
    getPendingAccess: async (_signal) => notBuiltYet('Pending access requests'),
    approveAccess: async (_accessId, _data) => notBuiltYet('Approving access requests'),

    getActiveSharing: async (signal) => {
        const response = await apiClient.get('/patient/active-sharing', { signal });
        return response.data;
    },

    revokeAccess: async (accessId) => {
        // BUG FIX: backend defines this route as DELETE, not POST — every
        // revoke attempt was rejected with 405 Method Not Allowed.
        const response = await apiClient.delete(`/patient/revoke-access/${accessId}`);
        return response.data;
    },

    // NOT BUILT YET: no medication-adherence-logging endpoint/table exists.
    logMedication: async (_medicationId) => notBuiltYet('Logging a medication dose'),

    // NOT BUILT YET: no /visit/* router exists anywhere in the backend —
    // hospital QR check-in/visit-creation hasn't been built server-side.
    scanHospitalQR: async (_qrData) => notBuiltYet('Scanning a hospital QR code'),
    createVisit: async (_hospital_id, _reason, _symptoms = '', _dept = '', _doctor = '') =>
        notBuiltYet('Creating a walk-in visit'),
    getVisits: async (_signal) => notBuiltYet('Visit history'),

    // NOT BUILT YET: there's no separate "access history" audit-log
    // endpoint — only "who currently has access" (getActiveSharing above).
    getAccessHistory: async (_signal) => notBuiltYet('Access history'),

    getPrescriptions: async (signal) => {
        // BUG FIX: was /clinical/prescriptions, which is the PHARMACIST
        // queue view (require_role pharmacist/doctor/admin/hospital_admin)
        // — patients got 403 on every call. The real "my prescriptions"
        // endpoint is the top-level /prescriptions/ list, which now scopes
        // itself to the calling patient automatically.
        const response = await apiClient.get('/prescriptions/', { signal });
        const data = response.data?.data || response.data;
        return { prescriptions: Array.isArray(data) ? data : (data?.items || []) };
    },

    getPrescriptionDetail: async (prescriptionId, signal) => {
        // BUG FIX: was /clinical/prescriptions/{id} (wrong router, 404).
        const response = await apiClient.get(`/prescriptions/${prescriptionId}`, { signal });
        return response.data?.data || response.data;
    },

    // NOT BUILT YET: lab_results.py is an intentional placeholder (501) —
    // there is no LabResult model/spec in this codebase yet.
    getLabReports: async (_signal) => notBuiltYet('Lab reports'),
    getLabReportDetail: async (_orderId, _signal) => notBuiltYet('Lab report detail'),

    // NOT BUILT YET: there is no /referrals router at all, and no concept of
    // a "latest lab order" (lab ordering isn't built — see getLabReports).
    getLatestLabOrder: async (_signal) => notBuiltYet('Latest lab order lookup'),

    getLatestPrescription: async (signal) => {
        // BUG FIX: was /referrals/patients/latest-prescription, which never
        // existed. The real, already-working endpoint is the same patient-
        // scoped /prescriptions/ list used by getPrescriptions() above —
        // just take the most recent one (it's already sorted newest-first).
        const response = await apiClient.get('/prescriptions/', { signal });
        const data = response.data?.data || response.data;
        const list = Array.isArray(data) ? data : (data?.items || []);
        return list[0] || null;
    },

    // NOT BUILT YET: same as getLatestLabOrder — lab ordering/referrals
    // don't exist on the backend.
    submitPartnerLabRequest: async (_orderId, _partnerHospitalId) =>
        notBuiltYet('Sharing a lab order with a partner lab'),

    submitPartnerPharmacyRequest: async (prescriptionId, partnerPharmacyId) => {
        // FIX-RX1 (2026-06-24): /referrals/pharmacies/request doesn't exist
        // anywhere in the backend — there is no /referrals router at all.
        // The real, already-fully-built endpoint for this is
        // POST /prescriptions/{id}/share, which works against ANY pharmacy's
        // hospital_id (there's no separate referral/partner whitelist to
        // maintain — every registered pharmacy account is a valid target,
        // identified by whatever hospital_id their QR code encodes).
        const response = await apiClient.post(`/prescriptions/${prescriptionId}/share`, {
            pharmacy_hospital_id: partnerPharmacyId,
        });
        return response.data;
    },

    clearCache: () => {
        ephemeralClinicalCache.clear();
        console.log('[clinicalService] Ephemeral cache successfully purged.');
    }
};
