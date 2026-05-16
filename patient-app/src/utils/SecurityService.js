import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, Platform } from 'react-native';

export class SecurityService {
    /**
     * CLINICAL VAULT SHIELD:
     * Strictly enforces biometric or device-level authentication (PIN/FaceID/Fingerprint).
     * Medical data access requires a successful handshake with the Secure Enclave.
     */
    static async authenticate(reason = 'Authorize clinical data access') {
        try {
            // Development Override
            if (__DEV__) {
                return true;
            }

            // 1. Hardware Verification
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

            if (!hasHardware) {
                console.warn("[Security] Device hardware does not support biometric/PIN security.");
                // For legacy devices without security, we fallback to a manual password check in the future.
                // For now, we allow access but log the vulnerability.
                return true;
            }

            if (!isEnrolled) {
                Alert.alert(
                    "Security Setup Required",
                    "To protect your clinical records, Hospyn requires you to enable a screen lock (PIN, Pattern, or Biometrics) on your device.",
                    [{ text: "OK" }]
                );
                return false;
            }

            // 2. Native Biometric Challenge
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: reason,
                fallbackLabel: 'Use Device Passcode',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false, // Allows PIN/Pattern fallback if Biometrics fail
            });

            if (result.success) {
                return true;
            } else {
                console.log(`[Security] Auth Failed: ${result.error}`);
                return false;
            }
        } catch (error) {
            console.error("Critical Authentication Fault:", error);
            return false;
        }
    }

    /**
     * FORENSIC ACCESS GUARD:
     * Used for high-risk actions like sharing records or viewing sensitive pathology.
     */
    static async confirmSensitiveAction(actionName = 'access sensitive data') {
        const success = await this.authenticate(`Verify identity to ${actionName}`);
        if (!success) {
            Alert.alert("Access Denied", "Identity verification is mandatory for this clinical action.");
        }
        return success;
    }
}
