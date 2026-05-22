import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const patientService = {
    getProfile: async (signal) => {
        try {
            const response = await apiClient.get('/patient/profile', { signal });
            await AsyncStorage.setItem('@hospyn_profile_cache', JSON.stringify(response.data));
            return response.data;
        } catch (e) {
            // For CancelErrors, we just rethrow so UI can handle (or ignore) cleanly
            if (e.name === 'CanceledError' || e.name === 'AbortError') {
                throw e;
            }
            
            console.warn('[patientService] Network failure, attempting to load offline profile...');
            const cachedStr = await AsyncStorage.getItem('@hospyn_profile_cache');
            if (cachedStr) {
                try {
                    return JSON.parse(cachedStr);
                } catch (parseErr) {
                    console.error('Cache corrupted:', parseErr);
                }
            }
            throw e;
        }
    },

    updateProfile: async (data) => {
        try {
            const response = await apiClient.post('/patient/profile/update', data);
            
            // Re-sync local cache
            const currentStr = await AsyncStorage.getItem('@hospyn_profile_cache');
            const current = currentStr ? JSON.parse(currentStr) : {};
            const updated = { ...current, ...data };
            await AsyncStorage.setItem('@hospyn_profile_cache', JSON.stringify(updated));
            
            return response.data;
        } catch (e) {
            console.error('[patientService] Profile update failed.');
            throw e;
        }
    },

    getNotifications: async (signal) => {
        const response = await apiClient.get('/patient/notifications', { signal });
        return response.data;
    }
};
