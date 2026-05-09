// NOTE: expo-secure-store, expo-local-authentication, expo-screen-capture
// are native-only. Do NOT import them at module level — they crash web bundles.
// Use lazy requires inside Platform.OS checks instead.
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'patient_mulajna_auth_token'; 
const AHP_ID_KEY = 'patient_mulajna_hospyn_id';

export const SecurityUtils = {
    // --- Secure Token Management ---
    async saveToken(token) {
        try {
            if (Platform.OS === 'web') {
                await AsyncStorage.setItem(TOKEN_KEY, token);
            } else {
                const SecureStore = require('expo-secure-store');
                await SecureStore.setItemAsync(TOKEN_KEY, token);
            }
        } catch (e) {
            console.error('[Security] Save Error:', e);
        }
    },

    async getToken() {
        try {
            if (Platform.OS === 'web') {
                return await AsyncStorage.getItem(TOKEN_KEY);
            } else {
                const SecureStore = require('expo-secure-store');
                return await SecureStore.getItemAsync(TOKEN_KEY);
            }
        } catch (e) {
            console.error('[Security] Fetch Error:', e);
            return null;
        }
    },

    async deleteToken() {
        try {
            if (Platform.OS === 'web') {
                await AsyncStorage.removeItem(TOKEN_KEY);
            } else {
                const SecureStore = require('expo-secure-store');
                await SecureStore.deleteItemAsync(TOKEN_KEY);
            }
        } catch (e) {
            console.error('[Security] Delete Error:', e);
        }
    },

    async saveHospynId(id) {
        try {
            if (Platform.OS === 'web') {
                await AsyncStorage.setItem(AHP_ID_KEY, id);
            } else {
                const SecureStore = require('expo-secure-store');
                await SecureStore.setItemAsync(AHP_ID_KEY, id);
            }
        } catch (e) {
            console.error('[Security] ID Save Error:', e);
        }
    },

    async getHospynId() {
        try {
            if (Platform.OS === 'web') {
                return await AsyncStorage.getItem(AHP_ID_KEY);
            } else {
                const SecureStore = require('expo-secure-store');
                return await SecureStore.getItemAsync(AHP_ID_KEY);
            }
        } catch (e) {
            return null;
        }
    },

    // --- Biometric Authentication (native only) ---
    async isBiometricAvailable() {
        if (Platform.OS === 'web') return false;
        try {
            const LocalAuthentication = require('expo-local-authentication');
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
            return hasHardware && isEnrolled && supportedTypes.length > 0;
        } catch (e) {
            return false;
        }
    },

    async authenticateWithBiometrics() {
        if (Platform.OS === 'web') return false;
        try {
            const available = await this.isBiometricAvailable();
            if (!available) return false;
            const LocalAuthentication = require('expo-local-authentication');
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Secure Access to Mulajna',
                fallbackLabel: 'Use Device Passcode',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false,
            });
            return result.success;
        } catch (e) {
            console.error('[Security] Biometric failure:', e);
            return false;
        }
    },

    // --- Data Protection (native only) ---
    async enableScreenshotProtection() {
        if (Platform.OS === 'web') return;
        try {
            const ScreenCapture = require('expo-screen-capture');
            await ScreenCapture.preventScreenCaptureAsync();
        } catch (e) {
            console.warn('[Security] Protection suppressed:', e);
        }
    },

    async disableScreenshotProtection() {
        if (Platform.OS === 'web') return;
        try {
            const ScreenCapture = require('expo-screen-capture');
            await ScreenCapture.allowScreenCaptureAsync();
        } catch (e) {
            // Silently ignore
        }
    }
};
