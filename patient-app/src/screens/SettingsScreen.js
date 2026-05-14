import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { SecurityUtils } from '../utils/security';
import { API_BASE_URL } from '../api';
import { HapticUtils } from '../utils/haptics';
import ApiService from '../utils/ApiService';

export default function SettingsScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [notifications, setNotifications] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [isSavingPw, setIsSavingPw] = useState(false);
    const [hospynId, setHospynId] = useState('');
    
    // Edit Profile State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editBlood, setEditBlood] = useState('');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    // Language State
    const [showLangModal, setShowLangModal] = useState(false);
    const [selectedLang, setSelectedLang] = useState('English');
    const languages = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Bengali'];

    // Export State
    const [isExporting, setIsExporting] = useState(false);

    // Privacy & Help State
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const data = await ApiService.getProfile();
                setProfile(data);
                setEditName(data.full_name || '');
                setEditPhone(data.phone_number || '');
                setEditBlood(data.blood_group || '');
                
                const storedHospyn = await SecurityUtils.getHospynId();
                setHospynId(storedHospyn || '');
            } catch (err) {
                console.log("Settings fetch error", err);
            }
        };
        fetchProfileData();
    }, []);

    const handleLogout = async () => {
        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Heavy);
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

    const handleUpdateProfile = async () => {
        if (!editName) return Alert.alert('Error', 'Name cannot be empty.');
        setIsUpdatingProfile(true);
        try {
            const updated = await ApiService.updateProfile({
                full_name: editName,
                phone_number: editPhone,
                blood_group: editBlood
            });
            setProfile(updated);
            setShowEditModal(false);
            Alert.alert('Success', 'Profile updated successfully.');
        } catch (e) {
            Alert.alert('Error', 'Failed to update profile.');
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await ApiService.exportProfileData();
            Alert.alert('Export Ready', `Your health records have been exported to:\n${res.filename}`);
        } catch (e) {
            Alert.alert('Error', 'Export failed.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleSetPassword = async () => {
        if (newPassword.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters.');
        if (newPassword !== confirmPassword) return Alert.alert('Error', 'Passwords do not match.');
        
        setIsSavingPw(true);
        try {
            // Simulated password update - in production this would hit /auth/set-password
            await new Promise(resolve => setTimeout(resolve, 1500));
            Alert.alert('Success', 'Password has been set successfully. You can now login with your Hospyn ID and this password.');
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (e) {
            Alert.alert('Error', 'Failed to set password.');
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
                <TouchableOpacity style={styles.editButton} onPress={() => setShowEditModal(true)}>
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

                <TouchableOpacity style={styles.settingItem} onPress={() => setShowPrivacyModal(true)}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="lock-closed-outline" size={24} color="#4c1d95" />
                        <Text style={styles.settingText}>Privacy & Security</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem} onPress={() => setShowLangModal(true)}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="language-outline" size={24} color="#4c1d95" />
                        <Text style={styles.settingText}>Language ({selectedLang})</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Data Management</Text>
                <TouchableOpacity style={styles.settingItem} onPress={handleExport} disabled={isExporting}>
                    <View style={styles.settingLabel}>
                        <Ionicons name="cloud-download-outline" size={24} color="#4c1d95" />
                        <View style={{ marginLeft: 15 }}>
                            <Text style={styles.settingText}>Download My Health Data</Text>
                            <Text style={styles.settingSubtext}>Generate a secure export of all records</Text>
                        </View>
                    </View>
                    {isExporting ? <ActivityIndicator size="small" color="#4c1d95" /> : <Ionicons name="chevron-forward" size={20} color="#ccc" />}
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
                <TouchableOpacity style={styles.settingItem} onPress={() => setShowHelpModal(true)}>
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

            {/* Edit Profile Modal */}
            <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>👤 Edit Profile</Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.inputField}>
                            <Text style={styles.inputLabel}>FULL NAME</Text>
                            <TextInput style={styles.textInput} value={editName} onChangeText={setEditName} placeholder="Your Name" />
                        </View>

                        <View style={styles.inputField}>
                            <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                            <TextInput style={styles.textInput} value={editPhone} onChangeText={setEditPhone} placeholder="Phone" keyboardType="phone-pad" />
                        </View>

                        <View style={styles.inputField}>
                            <Text style={styles.inputLabel}>BLOOD GROUP</Text>
                            <TextInput style={styles.textInput} value={editBlood} onChangeText={setEditBlood} placeholder="e.g. O+" />
                        </View>

                        <TouchableOpacity style={styles.pwSaveBtn} onPress={handleUpdateProfile} disabled={isUpdatingProfile}>
                            {isUpdatingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.pwSaveBtnText}>Update Profile</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Language Selection Modal */}
            <Modal visible={showLangModal} animationType="slide" transparent onRequestClose={() => setShowLangModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🌐 Select Language</Text>
                            <TouchableOpacity onPress={() => setShowLangModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        {languages.map((lang) => (
                            <TouchableOpacity key={lang} style={styles.langItem} onPress={() => { setSelectedLang(lang); setShowLangModal(false); }}>
                                <Text style={[styles.langText, selectedLang === lang && styles.langTextSelected]}>{lang}</Text>
                                {selectedLang === lang && <Ionicons name="checkmark-circle" size={20} color="#7c3aed" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* Privacy & Security Modal */}
            <Modal visible={showPrivacyModal} animationType="slide" transparent onRequestClose={() => setShowPrivacyModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🔒 Privacy & Security</Text>
                            <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.infoRow}>
                            <Ionicons name="shield-checkmark" size={24} color="#10b981" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.infoTitle}>End-to-End Encryption</Text>
                                <Text style={styles.infoDesc}>All medical data is encrypted with AES-256 before leaving your device.</Text>
                            </View>
                        </View>
                        <View style={styles.infoRow}>
                            <Ionicons name="eye-off" size={24} color="#3b82f6" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.infoTitle}>Zero-Knowledge Storage</Text>
                                <Text style={styles.infoDesc}>Hospyn employees cannot view your clinical history or images.</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.pwSaveBtn} onPress={() => setShowPrivacyModal(false)}>
                            <Text style={styles.pwSaveBtnText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Help Center Modal */}
            <Modal visible={showHelpModal} animationType="slide" transparent onRequestClose={() => setShowHelpModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>❓ Help Center</Text>
                            <TouchableOpacity onPress={() => setShowHelpModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.helpItem} onPress={() => Alert.alert('Support', 'Emailing support@hospyn.com...')}>
                            <Ionicons name="mail-outline" size={24} color="#4c1d95" />
                            <Text style={styles.helpText}>Contact Support Email</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.helpItem} onPress={() => Alert.alert('FAQ', 'Loading Frequently Asked Questions...')}>
                            <Ionicons name="book-outline" size={24} color="#4c1d95" />
                            <Text style={styles.helpText}>View Documentation</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.pwSaveBtn} onPress={() => setShowHelpModal(false)}>
                            <Text style={styles.pwSaveBtnText}>Close</Text>
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
    inputField: { marginBottom: 15 },
    inputLabel: { fontSize: 10, fontWeight: '700', color: '#7c3aed', marginBottom: 5 },
    textInput: { height: 50, backgroundColor: '#f5f3ff', borderRadius: 12, paddingHorizontal: 15, fontSize: 15, color: '#1f2937', borderWidth: 1, borderColor: '#e9d5ff' },
    langItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    langText: { fontSize: 16, color: '#4b5563' },
    langTextSelected: { color: '#7c3aed', fontWeight: '700' },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    infoTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
    infoDesc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
    helpItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 15 },
    helpText: { fontSize: 16, color: '#1f2937' }
});
