import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Universal Haptic Wrapper
 * Prevents "Method not found" crashes on Web while providing
 * full native feedback on iOS and Android.
 */
export const HapticUtils = {
    notificationAsync: async (type) => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.notificationAsync(type);
        } catch (e) {
            // Silently fail if native module is missing
        }
    },

    impactAsync: async (style) => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.impactAsync(style);
        } catch (e) {
            // Silently fail
        }
    },

    selectionAsync: async () => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.selectionAsync();
        } catch (e) {
            // Silently fail
        }
    },

    // Re-export Constants for convenience with safe fallbacks
    NotificationFeedbackType: Haptics?.NotificationFeedbackType || { Success: 'success', Warning: 'warning', Error: 'error' },
    ImpactFeedbackStyle: Haptics?.ImpactFeedbackStyle || { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
};
