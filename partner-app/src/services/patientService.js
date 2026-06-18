import apiClient from './apiClient';
import { SecurityUtils } from '../utils/security';

// Zero-footprint ephemeral in-memory cache (HIPAA/GDPR compliance)
const ephemeralProfileCache = new Map();

export const patientService = {
    getProfile: async (signal) => {
        const activeMemberId = await SecurityUtils.getActiveMemberId() || 'primary';
        try {
            // Gateway: /api/v1/patient/profile → healthcare/patients/profile
            const response = await apiClient.get('/api/v1/patient/profile', { signal });
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
            // Gateway: /api/v1/patient/profile/update → healthcare/patients/profile/update
            const response = await apiClient.post('/api/v1/patient/profile/update', data);
            
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
        // Gateway: /api/v1/patient/notifications → healthcare/patients/notifications
        const response = await apiClient.get('/api/v1/patient/notifications', { signal });
        return response.data;
    },

    getAppointments: async (signal) => {
        // Gateway: /api/v1/appointments/ → healthcare/appointments/
        const response = await apiClient.get('/api/v1/appointments/', { signal });
        return response.data;
    },

    getVitals: async (signal) => {
        // Gateway: /api/v1/patient/vitals → healthcare/patients/vitals
        const response = await apiClient.get('/api/v1/patient/vitals', { signal });
        return response.data;
    },

    clearCache: () => {
        ephemeralProfileCache.clear();
        console.log('[patientService] Ephemeral cache successfully purged.');
    }
};

