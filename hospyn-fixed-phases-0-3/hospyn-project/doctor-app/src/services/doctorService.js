import apiClient from './apiClient';

export const doctorService = {
    /**
     * Fetch the doctor's own profile
     */
    getProfile: async () => {
        return apiClient.get('/doctor/profile/me');
    },

    /**
     * Fetch dashboard statistics for the doctor
     */
    getStats: async () => {
        return apiClient.get('/doctor/stats');
    },

    /**
     * Fetch alerts/notifications - fixed from /clinical/alerts to /doctor/alerts
     */
    getAlerts: async () => {
        return apiClient.get('/doctor/alerts');
    },

    /**
     * Fetch security access history - fixed from /profile/access-history to /doctor/access-history
     */
    getAccessHistory: async () => {
        return apiClient.get('/doctor/access-history');
    }
};
