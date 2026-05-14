import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'hospyn_auth_token';
const ID_KEY = 'hospyn_id';

/**
 * Hospyn Secure Storage Utility
 * Ensures medical session tokens are stored in the hardware-backed Secure Enclave/Keystore.
 */
const HospynSecurity = {
  save: async (key, value) => {
    try {
      if (!value) {
        console.warn('HOSPYN_SECURITY: Attempted to save empty value for', key);
        value = ""; // Convert null/undefined to empty string to prevent crash
      }
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
      }
      return true;
    } catch (error) {
      console.error('HOSPYN_SECURE_STORAGE_ERROR: Failed to save key', key, error);
      return false;
    }
  },

  get: async (key) => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      } else {
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error('HOSPYN_SECURE_STORAGE_ERROR: Failed to retrieve key', key, error);
      return null;
    }
  },

  remove: async (key) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
      return true;
    } catch (error) {
      console.error('HOSPYN_SECURE_STORAGE_ERROR: Failed to delete key', key, error);
      return false;
    }
  },

  // --- Convenience Methods ---

  getToken: async () => {
    return await HospynSecurity.get(TOKEN_KEY);
  },

  saveToken: async (token) => {
    return await HospynSecurity.save(TOKEN_KEY, token);
  },

  deleteToken: async () => {
    return await HospynSecurity.remove(TOKEN_KEY);
  },

  getHospynId: async () => {
    return await HospynSecurity.get(ID_KEY);
  },

  saveHospynId: async (id) => {
    return await HospynSecurity.save(ID_KEY, id);
  }
};

export const SecurityUtils = HospynSecurity;
export default HospynSecurity;
