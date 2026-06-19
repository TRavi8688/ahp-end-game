import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Hospyn Premium Haptic Interaction Engine
 * Provides physical feedback for digital clinical actions.
 */
class HapticUtils {
    /**
     * Light impact for subtle feedback (e.g. typing, small toggles)
     */
    static light() {
        if (Platform.OS === 'web') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    /**
     * Medium impact for primary actions (e.g. navigation, selection)
     */
    static medium() {
        if (Platform.OS === 'web') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    /**
     * Heavy impact for critical or dangerous actions
     */
    static heavy() {
        if (Platform.OS === 'web') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    /**
     * Success notification (triple vibration)
     */
    static success() {
        if (Platform.OS === 'web') return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    /**
     * Error notification (warning vibration)
     */
    static error() {
        if (Platform.OS === 'web') return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    /**
     * Selection feedback (subtle tick)
     */
    static selection() {
        if (Platform.OS === 'web') return;
        Haptics.selectionAsync();
    }
}

export default HapticUtils;
