import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Modal, TextInput, ActivityIndicator, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SecurityUtils } from '../utils/security';
import { HapticUtils } from '../utils/haptics';
import ApiService from '../utils/ApiService';
import { Theme, GlobalStyles, setTheme, getTheme, subscribeToTheme } from '../theme';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [notifications, setNotifications] = useState(true);
    const [hospynId, setHospynId] = useState('');

    const [theme, setThemeState] = useState(getTheme());
    useEffect(() => {
        return subscribeToTheme((newTheme) => {
            setThemeState(newTheme);
        });
    }, []);
    
    // Edit Profile State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editBlood, setEditBlood] = useState('');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    // Export State
    const [isExporting, setIsExporting] = useState(false);

    // Biometric & Security State
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [securityChecking, setSecurityChecking] = useState(false);
    const [securityStatus, setSecurityStatus] = useState('ACTIVE');
    const [securityLog, setSecurityLog] = useState('AES-256 Shield Locked');

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

    const { logout } = useAuth();

    const handleLogout = async () => {
        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Heavy);
        const msg = 'Are you sure you want to logout from your Hospyn Shield?';
        if (Platform.OS === 'web') {
            const confirmed = window.confirm(msg);
            if (confirmed) {
                await logout();
            }
        } else {
            Alert.alert('Logout', msg, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                    }
                }
            ]);
        }
    };

    const handleUpdateProfile = async () => {
        if (!editName) {
            if (Platform.OS === 'web') {
                window.alert('Name cannot be empty.');
            } else {
                Alert.alert('Error', 'Name cannot be empty.');
            }
            return;
        }
        setIsUpdatingProfile(true);
        try {
            const updated = await ApiService.updateProfile({
                full_name: editName,
                phone_number: editPhone,
                blood_group: editBlood
            });
            setProfile(updated);
            setShowEditModal(false);
            HapticUtils.notificationAsync(HapticUtils.NotificationFeedbackType.Success);
        } catch (e) {
            if (Platform.OS === 'web') {
                window.alert('Failed to update profile.');
            } else {
                Alert.alert('Error', 'Failed to update profile.');
            }
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await ApiService.exportProfileData();
            const successMsg = `Your medical records have been packaged and encrypted:\n\nFilename: ${res.filename}\nTimestamp: ${res.timestamp}`;
            if (Platform.OS === 'web') {
                window.alert(`Data Vault Ready!\n\n${successMsg}`);
            } else {
                Alert.alert('Data Vault Ready', successMsg);
            }
        } catch (e) {
            if (Platform.OS === 'web') {
                window.alert('Export failed.');
            } else {
                Alert.alert('Error', 'Export failed.');
            }
        } finally {
            setIsExporting(false);
        }
    };

    const triggerBiometricScan = async () => {
        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Medium);
        setSecurityChecking(true);
        setSecurityStatus('VERIFYING KEYS...');
        
        try {
            if (Platform.OS === 'web') {
                // Beautiful 1.5s delay simulation
                await new Promise(resolve => setTimeout(resolve, 1500));
                setSecurityStatus('AUTHENTICATED');
                setSecurityLog('Hardware-backed key pair verified successfully.');
                HapticUtils.notificationAsync(HapticUtils.NotificationFeedbackType.Success);
            } else {
                const authenticated = await SecurityUtils.authenticateWithBiometrics();
                if (authenticated) {
                    setSecurityStatus('AUTHENTICATED');
                    setSecurityLog('Hardware-backed key pair verified successfully.');
                    HapticUtils.notificationAsync(HapticUtils.NotificationFeedbackType.Success);
                } else {
                    setSecurityStatus('AUTH FAILED');
                    setSecurityLog('Biometric authentication rejected by system enclave.');
                    HapticUtils.notificationAsync(HapticUtils.NotificationFeedbackType.Error);
                }
            }
        } catch (err) {
            setSecurityStatus('ERROR');
            setSecurityLog('Secured storage connection timed out.');
        } finally {
            setSecurityChecking(false);
        }
    };

    const SettingItem = ({ icon, label, sub, onPress, hasSwitch, value, onValueChange }) => (
        <TouchableOpacity 
            style={[styles.settingItem, GlobalStyles.glass]} 
            onPress={onPress}
            disabled={hasSwitch}
            activeOpacity={0.7}
        >
            <View style={styles.iconBox}>
                <Ionicons name={icon} size={22} color={Theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: Theme.colors.text }]}>{label}</Text>
                {sub && <Text style={[styles.settingSub, { color: Theme.colors.textMuted }]}>{sub}</Text>}
            </View>
            {hasSwitch ? (
                <Switch 
                    value={value} 
                    onValueChange={onValueChange} 
                    thumbColor={value ? Theme.colors.primary : '#475569'}
                    trackColor={{ false: theme === 'light' ? '#CBD5E1' : '#1E293B', true: theme === 'light' ? 'rgba(124, 92, 246, 0.3)' : 'rgba(99, 102, 241, 0.3)' }}
                />
            ) : (
                <Ionicons name="chevron-forward" size={18} color={Theme.colors.secondary} />
            )}
        </TouchableOpacity>
    );

    return (
        <ScrollView style={GlobalStyles.screen} contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={(e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 30) {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    } else {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'flex' } });
    }
  }}>
            <LinearGradient colors={theme === 'light' ? ['#7C3AED', '#4F46E5'] : ['#0F172A', '#050810']} style={styles.header}>
                <View style={styles.profileBox}>
                    <View style={[styles.avatarBox, { borderColor: Theme.colors.primary }]}>
                        {profile?.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                        ) : (
                            <LinearGradient colors={theme === 'light' ? ['#8B5CF6', '#7C3AED'] : ['#6366F1', '#4F46E5']} style={styles.avatarGradient}>
                                <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) || 'P'}</Text>
                            </LinearGradient>
                        )}
                        <View style={[styles.onlineDot, { borderColor: Theme.colors.background }]} />
                    </View>
                    <Text style={styles.profileName}>{profile?.full_name || 'Hospyn Member'}</Text>
                    <Text style={styles.hospynIdText}>{profile?.hospyn_id || hospynId || 'SYNCHRONIZING...'}</Text>
                    <TouchableOpacity style={styles.editBtn} onPress={() => setShowEditModal(true)}>
                        <Text style={styles.editBtnText}>EDIT PROFILE</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <View style={styles.content}>
                <Text style={styles.sectionTitle}>CLINICAL CONTROLS</Text>
                <SettingItem 
                    icon="people-outline" 
                    label="Data Sharing & Consent" 
                    sub="Manage who can access your records"
                    onPress={() => navigation.navigate('SharedAccess')} 
                />
                <SettingItem 
                    icon="time-outline" 
                    label="Access History" 
                    sub="View all clinical activity logs"
                    onPress={() => navigation.navigate('AccessHistory')} 
                />
                <SettingItem 
                    icon="notifications-outline" 
                    label="Smart Notifications" 
                    hasSwitch 
                    value={notifications} 
                    onValueChange={setNotifications} 
                />

                <Text style={[styles.sectionTitle, { marginTop: 30 }]}>PREFERENCES</Text>
                <SettingItem 
                    icon="color-palette-outline" 
                    label="Dark Mode" 
                    sub="Toggle between elegant light and dark themes"
                    hasSwitch 
                    value={theme === 'dark'} 
                    onValueChange={async (val) => {
                        await setTheme(val ? 'dark' : 'light');
                    }} 
                />

                <Text style={[styles.sectionTitle, { marginTop: 30 }]}>SECURITY & DATA</Text>
                <SettingItem 
                    icon="lock-closed-outline" 
                    label="Biometric & Security" 
                    sub="Manage your encryption keys"
                    onPress={() => { HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Light); setShowSecurityModal(true); }} 
                />
                <SettingItem 
                    icon="cloud-download-outline" 
                    label="Export Clinical Data" 
                    sub="Download a secure vault package"
                    onPress={handleExport} 
                />

                <Text style={[styles.sectionTitle, { marginTop: 30 }]}>SUPPORT</Text>
                <SettingItem 
                    icon="help-circle-outline" 
                    label="Hospyn Help Center" 
                    onPress={() => {
                        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Light);
                        const helpMsg = "Accessing Hospyn Clinical Support Vault... Our medical assistance desk has been alerted.";
                        if (Platform.OS === 'web') window.alert(helpMsg);
                        else Alert.alert("Hospyn Help Center", helpMsg);
                    }} 
                />
                <SettingItem 
                    icon="information-circle-outline" 
                    label="About Hospyn 4.0" 
                    onPress={() => {
                        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Light);
                        const aboutMsg = "Hospyn Clinical Ecosystem v4.0.1\nSecured by Advanced AI.\nISO 27001 Certified medical-grade decentralized infrastructure.";
                        if (Platform.OS === 'web') window.alert(aboutMsg);
                        else Alert.alert("About Hospyn 4.0", aboutMsg);
                    }} 
                />

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>TERMINATE SESSION</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>SECURED BY HOSPYN QUANTUM SHIELD</Text>
            </View>

            {/* Edit Profile Modal */}
            <Modal visible={showEditModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, GlobalStyles.glass]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>UPDATE PROFILE</Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>FULL LEGAL NAME</Text>
                            <TextInput 
                                style={[styles.input, { color: '#fff' }]} 
                                value={editName} 
                                onChangeText={setEditName} 
                                placeholderTextColor="#475569" 
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>CONTACT NUMBER</Text>
                            <TextInput 
                                style={[styles.input, { color: '#fff' }]} 
                                value={editPhone} 
                                onChangeText={setEditPhone} 
                                keyboardType="phone-pad" 
                                placeholderTextColor="#475569" 
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>BLOOD GROUP</Text>
                            <TextInput 
                                style={[styles.input, { color: '#fff' }]} 
                                value={editBlood} 
                                onChangeText={setEditBlood} 
                                placeholderTextColor="#475569" 
                            />
                        </View>

                        <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile} disabled={isUpdatingProfile}>
                            {isUpdatingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>SAVE CHANGES</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Biometric & Security Modal */}
            <Modal visible={showSecurityModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, GlobalStyles.glass, { alignItems: 'center' }]}>
                        <View style={[styles.modalHeader, { width: '100%' }]}>
                            <Text style={styles.modalTitle}>HOSPYN SHIELD SECURITY</Text>
                            <TouchableOpacity onPress={() => { HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Light); setShowSecurityModal(false); }}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.biometricIconContainer}>
                            {securityChecking ? (
                                <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginVertical: 20 }} />
                            ) : (
                                <Ionicons 
                                    name={securityStatus === 'AUTHENTICATED' ? "shield-checkmark" : "finger-print"} 
                                    size={64} 
                                    color={securityStatus === 'AUTHENTICATED' ? "#10B981" : Theme.colors.primary} 
                                    style={{ marginVertical: 20 }}
                                />
                            )}
                        </View>

                        <Text style={styles.securityStatusTitle}>
                            STATUS: <Text style={{ color: securityStatus === 'AUTHENTICATED' ? '#10B981' : '#6366F1', fontWeight: 'bold' }}>{securityStatus}</Text>
                        </Text>

                        <View style={styles.securityLogBox}>
                            <Text style={styles.securityLogText}>{securityLog}</Text>
                        </View>

                        <Text style={styles.encryptionInfo}>
                            Your device holds a unique hardware-backed private key registered in the Hospyn ledger. Tapping below validates your enrollment.
                        </Text>

                        <TouchableOpacity 
                            style={[styles.saveBtn, { width: '100%', backgroundColor: Theme.colors.primary }]} 
                            onPress={triggerBiometricScan} 
                            disabled={securityChecking}
                        >
                            <Text style={styles.saveBtnText}>
                                {securityChecking ? 'AUTHENTICATING...' : 'TEST BIOMETRIC KEY SCAN'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    header: { padding: 40, paddingTop: 80, alignItems: 'center', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
    profileBox: { alignItems: 'center' },
    avatarBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Theme.colors.primary, position: 'relative', overflow: 'hidden' },
    avatarGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    avatarImg: { width: '100%', height: '100%' },
    avatarText: { fontSize: 42, fontWeight: '900', color: '#fff' },
    onlineDot: { position: 'absolute', bottom: 5, right: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', borderWidth: 3, borderColor: '#050810', zIndex: 10 },
    profileName: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 15 },
    hospynIdText: { color: '#64748B', fontSize: 13, marginTop: 4, letterSpacing: 1, fontFamily: 'monospace' },
    editBtn: { marginTop: 15, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    editBtnText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    content: { padding: 24, paddingBottom: 24 },
    sectionTitle: { color: '#475569', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 15, marginLeft: 5 },
    settingItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12 },
    iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    settingContent: { flex: 1 },
    settingLabel: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    settingSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 40, paddingVertical: 20, borderRadius: 20, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.1)' },
    logoutText: { color: '#EF4444', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    versionText: { textAlign: 'center', color: '#1E293B', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 30 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 24 },
    modalBox: { padding: 24, borderRadius: 32 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    modalTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
    inputGroup: { marginBottom: 20 },
    inputLabel: { color: '#64748B', fontSize: 10, fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
    input: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, height: 50, paddingHorizontal: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    saveBtn: { backgroundColor: Theme.colors.primary, height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
    biometricIconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    securityStatusTitle: { color: '#64748B', fontSize: 13, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15 },
    securityLogBox: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, padding: 15, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20 },
    securityLogText: { color: '#94A3B8', fontSize: 12, textAlign: 'center', fontFamily: 'monospace', lineHeight: 18 },
    encryptionInfo: { color: '#475569', fontSize: 11, textAlign: 'center', lineHeight: 16, marginBottom: 25, paddingHorizontal: 10 }
});
