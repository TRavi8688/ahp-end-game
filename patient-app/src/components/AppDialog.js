/**
 * AppDialog — a branded, cross-platform confirm/alert dialog.
 *
 * BUG FIX: SettingsScreen (logout, delete account), FamilyProfilesScreen
 * (remove family member), and RegisterScreen (duplicate phone number) all
 * used `window.confirm()` / `window.alert()` on web — the browser's raw,
 * unstyled default popup ("hospyn-patient-app.web.app says...") instead of
 * anything that looks like part of the app. Native already used Alert.alert,
 * which looks fine on a phone but is visually inconsistent with web.
 *
 * showDialog() is a drop-in, Alert.alert-shaped replacement that renders the
 * same branded modal on every platform:
 *
 *   showDialog({
 *     title: 'Logout',
 *     message: 'Are you sure you want to logout?',
 *     buttons: [
 *       { text: 'Cancel', style: 'cancel' },
 *       { text: 'Logout', style: 'destructive', onPress: async () => { ... } },
 *     ],
 *   });
 *
 * <AppDialogHost /> is mounted once near the root (App.js) and renders
 * whatever showDialog() most recently requested.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme';

let currentRequest = null;
const listeners = new Set();

export function showDialog({ title, message, buttons }) {
    currentRequest = {
        title,
        message,
        buttons: buttons && buttons.length ? buttons : [{ text: 'OK', style: 'default' }],
    };
    listeners.forEach((cb) => cb(currentRequest));
}

// Convenience wrapper for simple single-button info/error alerts —
// a branded drop-in for window.alert()/Alert.alert('Title', msg).
export function showAlert(title, message) {
    showDialog({ title, message, buttons: [{ text: 'OK', style: 'default' }] });
}

export function AppDialogHost() {
    const { colors } = useTheme();
    const [request, setRequest] = useState(null);

    useEffect(() => {
        const cb = (req) => setRequest(req);
        listeners.add(cb);
        return () => listeners.delete(cb);
    }, []);

    if (!request) return null;

    const close = (button) => {
        setRequest(null);
        if (button && button.onPress) button.onPress();
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={() => close(null)}>
            <Pressable style={styles.overlay} onPress={() => close(null)}>
                <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
                    {!!request.title && (
                        <Text style={[styles.title, { color: colors.text }]}>{request.title}</Text>
                    )}
                    {!!request.message && (
                        <Text style={[styles.message, { color: colors.textMuted }]}>{request.message}</Text>
                    )}
                    <View style={styles.buttonRow}>
                        {request.buttons.map((btn, i) => {
                            const isDestructive = btn.style === 'destructive';
                            const isCancel = btn.style === 'cancel';
                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.button,
                                        isDestructive && { backgroundColor: colors.critical },
                                        !isDestructive && !isCancel && { backgroundColor: colors.primary },
                                        isCancel && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
                                    ]}
                                    onPress={() => close(btn)}
                                >
                                    <Text style={[
                                        styles.buttonText,
                                        { color: isCancel ? colors.text : '#FFFFFF' },
                                    ]}>
                                        {btn.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(7, 13, 23, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 18,
        borderWidth: 1,
        padding: 22,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    button: {
        paddingVertical: 11,
        paddingHorizontal: 18,
        borderRadius: 10,
        minWidth: 88,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
