import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, Platform } from 'react-native';

export class SecurityService {
    /**
     * NATIVE SHIELD: Uses the phone's built-in security (PIN, Fingerprint, FaceID).
     * This follows the 'PhonePe' pattern requested by the user.
     */
    static async authenticate(reason = 'Authenticate to continue') {
        try {
            // 1. Check if hardware supports biometrics or device PIN
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                // If no security set up, we let them through but log a warning
                // In production, we might want to force them to set a PIN
                console.warn("Security not configured on device.");
                return true;
            }

            // 2. Trigger native prompt
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: reason,
                fallbackLabel: 'Use Passcode',
                disableDeviceFallback: false,
            });

            return result.success;
        } catch (error) {
            console.error("Authentication Error:", error);
            return false;
        }
    }

    /**
     * SENSITIVE ACTION GUARD: Double-check before sharing data.
     */
    static async confirmSensitiveAction(actionName = 'share your medical records') {
        const success = await this.authenticate(`Confirm identity to ${actionName}`);
        if (!success) {
            Alert.alert("Security Block", "Identity verification failed. Action cancelled.");
        }
        return success;
    }
}
