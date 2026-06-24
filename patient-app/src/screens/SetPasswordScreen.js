// patient-app/src/screens/SetPasswordScreen.js
//
// NEW (2026-06-23): fixes the reported issue "Google account users have no
// way to set a Hospyn ID + password, so they have to tap Sign in with
// Google every single time." Reachable from Settings, and offered once
// automatically right after a first-time Google/Apple sign-in.

import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, GlobalStyles } from '../theme';
import { SecurityUtils } from '../utils/security';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

export default function SetPasswordScreen({ navigation }) {
    const { updateAuthProvider } = useAuth();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const handleSubmit = async () => {
        setError('');
        if (!/^\+?[0-9]{8,15}$/.test(phone.trim())) {
            setError('Enter a valid phone number, including country code (e.g. +91XXXXXXXXXX).');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirm) {
            setError("Passwords don't match.");
            return;
        }

        setLoading(true);
        try {
            const token = await SecurityUtils.getToken();
            await authService.setPassword(phone.trim(), password, token);
            await updateAuthProvider('local');
            setDone(true);
        } catch (e) {
            setError(e.response?.data?.detail || 'Could not set your password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <View style={[GlobalStyles.screen, styles.center]}>
                <Ionicons name="shield-checkmark" size={72} color={Theme.colors.positive} />
                <Text style={[styles.title, { color: Theme.colors.text }]}>You're all set</Text>
                <Text style={[styles.subtitle, { color: Theme.colors.textMuted }]}>
                    You can now log in with your phone number and password, or keep using Google — whichever's faster.
                </Text>
                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: Theme.colors.primary }]}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.primaryBtnText}>Done</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={GlobalStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: Theme.colors.text }]}>Set up Hospyn ID</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <Text style={[styles.subtitle, { color: Theme.colors.textMuted, marginBottom: 28 }]}>
                    You signed in with Google. Add a phone number and password so you can log in
                    either way — no need to tap "Sign in with Google" every time.
                </Text>

                <Text style={[GlobalStyles.label, styles.label]}>Phone number</Text>
                <TextInput
                    style={[styles.input, { borderColor: Theme.colors.border, color: Theme.colors.text }]}
                    placeholder="+91XXXXXXXXXX"
                    placeholderTextColor={Theme.colors.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                />

                <Text style={[GlobalStyles.label, styles.label]}>New password</Text>
                <TextInput
                    style={[styles.input, { borderColor: Theme.colors.border, color: Theme.colors.text }]}
                    placeholder="At least 8 characters"
                    placeholderTextColor={Theme.colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <Text style={[GlobalStyles.label, styles.label]}>Confirm password</Text>
                <TextInput
                    style={[styles.input, { borderColor: Theme.colors.border, color: Theme.colors.text }]}
                    placeholder="Re-enter password"
                    placeholderTextColor={Theme.colors.textMuted}
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry
                />

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: Theme.colors.primary, marginTop: 28 }, loading && { opacity: 0.7 }]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
                    <Text style={[styles.linkBtn, { color: Theme.colors.secondary }]}>Maybe later</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 16 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontFamily: Theme.fonts.headingSemi },
    content: { paddingHorizontal: 24, paddingTop: 12 },
    label: { marginTop: 18, marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, fontFamily: Theme.fonts.body },
    errorText: { color: '#EF4444', marginTop: 14, fontSize: 13, fontFamily: Theme.fonts.body },
    primaryBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { color: '#FFF', fontSize: 15, fontFamily: Theme.fonts.headingSemi },
    linkBtn: { fontSize: 14, fontFamily: Theme.fonts.body, textAlign: 'center' },
    center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    title: { fontSize: 20, fontFamily: Theme.fonts.headingSemi, marginTop: 16 },
    subtitle: { fontSize: 14, fontFamily: Theme.fonts.body, textAlign: 'center', lineHeight: 20, marginTop: 8 },
});
