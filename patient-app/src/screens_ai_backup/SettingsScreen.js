import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SecurityUtils } from '../utils/security';
import * as Haptics from 'expo-haptics';

export default function SettingsScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [notifications, setNotifications] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [isSavingPw, setIsSavingPw] = useState(false);
    const [hospynId, setHospynId] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = await SecurityUtils.getToken();
                const response = await axios.get(`${API_BASE_URL}/patient/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setProfile(response.data);
                const storedHospyn = await SecurityUtils.getHospynId();
                setHospynId(storedHospyn || '');
            } catch (err) {
                console.log("Settings fetch error", err);
            }
        };
        fetchProfile();
    }, []);

    const handleLogout = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert('Logout', 'Are you sure you want to logout from Hospyn?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await SecurityUtils.deleteToken();
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }
            }
        ]);
    };

    const handleSetPassword = async () => {
        if (newPassword.length < 6) return Alert.alert('Too Short', 'Password must be at least 6 characters.');
        if (newPassword !== confirmPassword) return Alert.alert('Mismatch', 'Passwords do not match.');
        setIsSavingPw(true);
        try {
            const token = await SecurityUtils.getToken();
            const resp = await axios.post(`${API_BASE_URL}/patient/set-password`, { password: newPassword }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = resp.data;
            await SecurityUtils.saveHospynId(data.hospyn_id || '');
            setHospynId(data.hospyn_id || '');
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
            Alert.alert('✅ Password Set!', `You can now login with:\n\nHospyn ID: ${data.hospyn_id}\nPassword: your chosen password`);
        } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || 'Failed to set password.');
        } finally {
            setIsSavingPw(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.profileSection}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) || 'P'}</Text>
                </View>
                <Text style={styles.name}>{profile?.full_name || 'Patient Name'}</Text>
                <Text style={styles.phone}>{profile?.phone_number || '+91 9999999999'}</Text>
                <TouchableOpacity style={styles.editButton}>
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>App Settings</Text>

                <View style={styles.settingItem}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="notifications-outline" size={24} color="#4c1d95" />
                        <Text style={styles.settingText}>Push Notifications</Text>
                    </View>
                    <Switch value={notifications} onValueChange={setNotifications} thumbColor="#4c1d95" trackColor={{ false: "#ddd", true: "#c4b5fd" }} />
                </View>

                <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Notifications')}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="notifications-outline" size={24} color="#4c1d95" />
                        <Text style={styles.settingText}>Alerts & Notifications</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('SharingSettings')}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="people-outline" size={24} color="#4c1d95" />
                        <Text style={styles.settingText}>Data Sharing & Consent</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('AccessHistory')}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="time-outline" size={24} color="#4c1d95" />
                        <Text style={styles.settingText}>Access History</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="lock-closed-outline" size={24} color="#4c1d95" />
                        <Text style={styles.settingText}>Privacy & Security</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="language-outline" size={24} color="#4c1d95" />
                        <Text style={styles.settingText}>Language (English)</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
            </View>

            {/* Hospyn ID Display */}
            {hospynId ? (
                <View style={styles.hospynBox}>
                    <Ionicons name="shield-checkmark" size={20} color="#7c3aed" />
                    <View style={styles.hospynBoxText}>
                        <Text style={styles.hospynLabel}>Your Hospyn ID (use to login)</Text>
                        <Text style={styles.hospynValue}>{hospynId}</Text>
                    </View>
                </View>
            ) : null}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Security</Text>
                <TouchableOpacity style={styles.settingItem} onPress={() => setShowPasswordModal(true)}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="key-outline" size={24} color="#4c1d95" />
                        <View style={{ marginLeft: 15 }}>
                            <Text style={styles.settingText}>Set Login Password</Text>
                            <Text style={styles.settingSubtext}>Login with Hospyn ID + password next time</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Support</Text>
                <TouchableOpacity style={styles.settingItem}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="help-circle-outline" size={24} color="#4c1d95" />
                        <Text style={styles.settingText}>Help Center</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
            </View>

            {/* Set Password Modal */}
            <Modal visible={showPasswordModal} animationType="slide" transparent onRequestClose={() => setShowPasswordModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🔑 Set Login Password</Text>
                            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>After setting a password, you can login with your Hospyn ID and this password without needing an OTP.</Text>
                        <View style={styles.pwInputRow}>
                            <TextInput
                                style={styles.pwInput}
                                placeholder="New password (min 6 chars)"
                                secureTextEntry={!showPw}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                placeholderTextColor="#bbb"
                            />
                            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#999" />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.pwInput, { marginTop: 12 }]}
                            placeholder="Confirm password"
                            secureTextEntry={!showPw}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholderTextColor="#bbb"
                        />
                        <TouchableOpacity style={styles.pwSaveBtn} onPress={handleSetPassword} disabled={isSavingPw}>
                            {isSavingPw ? <ActivityIndicator color="#fff" /> : <Text style={styles.pwSaveBtnText}>Save Password</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color="#dc2626" />
                <Text style={styles.logoutText}>Logout from Passport</Text>
            </TouchableOpacity>

            <Text style={styles.version}>Hospyn V4.0.1 — ENCRYPTED</Text>
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    profileSection: { alignItems: 'center', padding: 30, backgroundColor: '#f5f3ff' },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4c1d95', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
    name: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    phone: { fontSize: 14, color: '#6b7280', marginTop: 5 },
    editButton: { marginTop: 15, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#4c1d95' },
    editButtonText: { color: '#4c1d95', fontSize: 14, fontWeight: '600' },
    section: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    sectionTitle: { fontSize: 12, fontWeight: '900', color: '#9ca3af', marginBottom: 15, letterSpacing: 1 },
    settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    settingLabel: { flexDirection: 'row', alignItems: 'center' },
    settingText: { fontSize: 15, color: '#374151' },
    settingSubtext: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
    logoutButton: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 10 },
    logoutText: { fontSize: 15, color: '#dc2626', fontWeight: 'bold', marginLeft: 15 },
    version: { textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 20 },
    hospynBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f3ff', margin: 16, borderRadius: 16, padding: 14, gap: 12 },
    hospynBoxText: { flex: 1 },
    hospynLabel: { fontSize: 11, color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    hospynValue: { fontSize: 16, fontWeight: '900', color: '#4c1d95', fontFamily: 'monospace', marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#1f2937' },
    modalSubtitle: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 20 },
    pwInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f3ff', borderRadius: 14, borderWidth: 1.5, borderColor: '#e9d5ff', paddingHorizontal: 14, height: 52 },
    pwInput: { flex: 1, fontSize: 15, color: '#1f2937', height: 52, backgroundColor: '#f5f3ff', borderRadius: 14, borderWidth: 1.5, borderColor: '#e9d5ff', paddingHorizontal: 14 },
    pwSaveBtn: { backgroundColor: '#7c3aed', borderRadius: 16, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    pwSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
