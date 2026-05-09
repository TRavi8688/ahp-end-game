import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Hospyn Secure Storage Utility
 * Ensures medical session tokens are stored in the hardware-backed Secure Enclave/Keystore.
 */
const HospynSecurity = {
  /**
   * Save a sensitive value
   */
  save: async (key, value) => {
    try {
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

  /**
   * Retrieve a sensitive value
   */
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

  /**
   * Remove a sensitive value (Used for Logout/Data Deletion)
   */
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
  }
};

export default HospynSecurity;
