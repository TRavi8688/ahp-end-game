import apiClient from './apiClient';
import { SecurityUtils } from '../utils/security';

// Zero-footprint ephemeral in-memory cache (HIPAA/GDPR compliance)
const ephemeralProfileCache = new Map();

export const patientService = {
    getProfile: async (signal) => {
        const activeMemberId = await SecurityUtils.getActiveMemberId() || 'primary';
        try {
            const response = await apiClient.get('/patient/profile', { signal });
            ephemeralProfileCache.set(activeMemberId, response.data);
            return response.data;
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
            const response = await apiClient.post('/patient/profile/update', data);
            
            // Re-sync in-memory cache
            const current = ephemeralProfileCache.get(activeMemberId) || {};
            const updated = { ...current, ...data };
            ephemeralProfileCache.set(activeMemberId, updated);
            
            return response.data;
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
        const response = await apiClient.get('/patient/appointments', { signal });
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
