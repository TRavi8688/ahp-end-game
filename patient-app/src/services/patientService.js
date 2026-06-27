import apiClient from './apiClient';
import { SecurityUtils } from '../utils/security';

// Zero-footprint ephemeral in-memory cache (HIPAA/GDPR compliance)
const ephemeralProfileCache = new Map();

export const patientService = {
    getProfile: async (signal) => {
        const activeMemberId = await SecurityUtils.getActiveMemberId() || 'primary';
        try {
            // FIX-P1 (2026-06-24): /patient/profile doesn't exist anywhere in
            // the backend — the real "get my own profile" endpoint is
            // /patients/me, and its response is wrapped in
            // { success, message, data: {...} }.
            const response = await apiClient.get('/patients/me', { signal });
            const profile = response.data?.data || response.data;
            ephemeralProfileCache.set(activeMemberId, profile);
            return profile;
        } catch (e) {
            if (e.name === 'CanceledError' || e.name === 'AbortError') {
                throw e;
            }
            
            console.warn('[patientService] Network failure, attempting to load ephemeral in-memory profile...');
            const cached = ephemeralProfileCache.get(activeMemberId);
            if (cached) {
                return cached;
            }
            throw e;
        }
    },

    updateProfile: async (data) => {
        const activeMemberId = await SecurityUtils.getActiveMemberId() || 'primary';
        try {
            // FIX-P1: /patient/profile/update doesn't exist either. The real
            // endpoint is PUT /patients/{id} — needs the patient's own id,
            // which we already have from getProfile()/the cached profile.
            const cached = ephemeralProfileCache.get(activeMemberId);
            const patientId = data.id || cached?.id;
            if (!patientId) {
                throw new Error('Cannot update profile: missing patient id. Reload your profile first.');
            }
            const response = await apiClient.put(`/patients/${patientId}`, data);
            const updatedFromServer = response.data?.data || response.data;

            const current = cached || {};
            const updated = { ...current, ...updatedFromServer };
            ephemeralProfileCache.set(activeMemberId, updated);
            
            return updated;
        } catch (e) {
            console.error('[patientService] Profile update failed.');
            throw e;
        }
    },

    getNotifications: async (signal) => {
        const response = await apiClient.get('/patient/notifications', { signal });
        return response.data;
    },

    getAppointments: async (signal) => {
        // BUG FIX: /patient/appointments doesn't exist anywhere in the
        // backend. The real "my appointments" endpoint is the top-level
        // GET /appointments/ (already used by appointmentService.js), which
        // is scoped server-side to the calling patient.
        const response = await apiClient.get('/appointments/', { signal });
        return response.data;
    },

    getVitals: async (signal) => {
        const response = await apiClient.get('/patient/vitals', { signal });
        return response.data;
    },

    clearCache: () => {
        ephemeralProfileCache.clear();
        console.log('[patientService] Ephemeral cache successfully purged.');
    }
};
