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
        // Updated backend path
        return apiClient.get('/doctor/stats');
    },

    /**
     * Fetch alerts/notifications
     */
    getAlerts: async () => {
        // Mocked or redirected to standard endpoint
        return apiClient.get('/clinical/alerts');
    },

    /**
     * Fetch security access history
     */
    getAccessHistory: async () => {
        return apiClient.get('/profile/access-history');
    }
};
