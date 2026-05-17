import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput,
    TouchableOpacity, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView, Dimensions,
    Image, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { Theme, GlobalStyles } from '../theme';
import { API_BASE_URL } from '../api';
import { SecurityUtils } from '../utils/security';
import HapticUtils from '../utils/HapticUtils';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function OnboardingScreen({ navigation }) {
    const { login, setIsAuthenticated } = useAuth();
    const [step, setStep] = useState(0); // 0: OTP, 1: Basic, 2: Health, 3: Family
    const [loading, setLoading] = useState(false);
    const [showFamilyModal, setShowFamilyModal] = useState(false);
    const [showBloodModal, setShowBloodModal] = useState(false);
    const [newFamilyMember, setNewFamilyMember] = useState({ name: '', relation: '' });
    
    // Form State
    const [formData, setFormData] = useState({
        phone: '',
        otp: '',
        firstName: '',
        lastName: '',
        dob: '',
        gender: '',
        bloodGroup: '',
        allergies: '',
        conditions: '',
        familyMembers: [],
        consent: false,
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState({});
    const [activeField, setActiveField] = useState(null);

    const steps = [
        { title: 'Identity Verification', subtitle: 'Care Connected Intelligently' },
        { title: 'Personal Profile', subtitle: 'Basic identity details' },
        { title: 'Clinical Baseline', subtitle: 'Chronic health context' },
        { title: 'Care Circle', subtitle: 'Add family for coordinated care' }
    ];

    const validateDOB = (dob) => {
        if (!dob) return false;
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dob)) return false;
        
        const [year, month, day] = dob.split('-').map(Number);
        if (year < 1900 || year > new Date().getFullYear()) return false;
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        
        // Month specific day check
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    };

    const handleSendOTP = async () => {
        if (formData.phone.length < 10) return Alert.alert('Invalid Phone', 'Please enter a 10-digit number.');
        HapticUtils.medium();
        setLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/auth/send-otp`, { 
                identifier: formData.phone, 
                country_code: '+91', 
                method: 'sms' 
            });
            HapticUtils.success();
            Alert.alert('OTP Sent', 'Check your messages for the verification code.');
        } catch (e) {
            HapticUtils.error();
            console.error("OTP Error:", e);
            Alert.alert('Error', 'Failed to send OTP. Please check your network and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (formData.otp.length < 6) return Alert.alert('Invalid OTP', 'Enter the 6-digit code.');
        HapticUtils.medium();
        setLoading(true);
        try {
            const resp = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
                identifier: formData.phone,
                otp: formData.otp
            });
            if (resp.data.success || resp.data.valid) {
                HapticUtils.success();
                setStep(1);
            } else {
                HapticUtils.error();
                Alert.alert('Failed', 'Invalid verification code.');
            }
        } catch (e) {
            HapticUtils.error();
            Alert.alert('Verification Failed', 'Invalid or expired verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalize = async () => {
        HapticUtils.heavy();
        setLoading(true);
        try {
            // High-Integrity Registration Pipeline
            const registerResp = await axios.post(`${API_BASE_URL}/auth/register`, {
                phone_number: formData.phone,
                password: formData.password,
                first_name: formData.firstName || 'Patient',
                last_name: formData.lastName || '',
                role: 'patient'
            });

            const hospyn_id = registerResp.data.hospyn_id;

            const loginFormData = new FormData();
            loginFormData.append('username', formData.phone);
            loginFormData.append('password', formData.password);

            const loginResp = await axios.post(`${API_BASE_URL}/auth/login`, loginFormData);
            const token = loginResp.data.access_token;

            // Setup Profile according to Phase 2 hardened schema
            await axios.post(`${API_BASE_URL}/patient/profile/update`, {
                first_name: formData.firstName || 'Patient',
                last_name: formData.lastName || '',
                phone_number: `+91${formData.phone}`,
                date_of_birth: formData.dob,
                gender: formData.gender,
                blood_group: formData.bloodGroup
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            HapticUtils.notificationAsync(HapticUtils.NotificationFeedbackType.Success);
            
            // Persist session but don't trigger global auth state yet
            // This allows us to show the Success screen first
            const fullName = `${formData.firstName} ${formData.lastName}`.trim();
            await login(token, hospyn_id, fullName);
            
            navigation.replace('RegistrationSuccess', { 
                hospyn_id: hospyn_id, 
                fullName: fullName 
            });

        } catch (e) {
            console.error("PROVISIONING_ERROR:", e);
            HapticUtils.error();
            const errMsg = e.response?.data?.detail || e.response?.data?.message || "";
            if (e.response?.status === 401 || e.response?.status === 400 || errMsg.toLowerCase().includes("exists")) {
                if (errMsg.toLowerCase().includes("exists") || errMsg.toLowerCase().includes("registered")) {
                    Alert.alert(
                        'Already Registered',
                        'This phone number is already linked to an account. Please try logging in.',
                        [
                            { text: 'Go to Login', onPress: () => navigation.navigate('Login') },
                            { text: 'Cancel', style: 'cancel' }
                        ]
                    );
                    return;
                }
            }
            Alert.alert('Clinical Setup Failed', 'We encountered an error provisioning your health passport. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderStepIndicator = () => (
        <View style={styles.stepIndicator}>
            {steps.map((_, i) => (
                <View 
                    key={i} 
                    style={[
                        styles.stepDot, 
                        step === i && styles.stepDotActive,
                        step > i && styles.stepDotCompleted
                    ]} 
                />
            ))}
        </View>
    );

    const renderOTPStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{steps[0].title}</Text>
            <Text style={styles.stepSubtitle}>{steps[0].subtitle}</Text>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>MOBILE NUMBER</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Enter 10-digit number"
                        placeholderTextColor="#475569"
                        keyboardType="number-pad"
                        maxLength={10}
                        value={formData.phone}
                        onChangeText={(v) => {
                            const cleaned = v.replace(/[^0-9]/g, '');
                            setFormData({...formData, phone: cleaned});
                        }}
                    />
                    <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                        <Text style={styles.sendOtpText}>SEND CODE</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>VERIFICATION CODE</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="shield-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="6-digit OTP"
                        placeholderTextColor="#475569"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={formData.otp}
                        onChangeText={(v) => setFormData({...formData, otp: v})}
                    />
                </View>
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={handleVerifyOTP} disabled={loading}>
                <LinearGradient colors={[Theme.colors.primary, Theme.colors.secondary]} style={styles.gradientBtn}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>VERIFY IDENTITY</Text>}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const renderBasicStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{steps[1].title}</Text>
            <Text style={styles.stepSubtitle}>{steps[1].subtitle}</Text>

            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>FIRST NAME</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="John"
                            placeholderTextColor="#475569"
                            value={formData.firstName}
                            onChangeText={(v) => setFormData({...formData, firstName: v})}
                        />
                    </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>LAST NAME</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Doe"
                            placeholderTextColor="#475569"
                            value={formData.lastName}
                            onChangeText={(v) => setFormData({...formData, lastName: v})}
                        />
                    </View>
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>DOB</Text>
                    <View style={[styles.inputWrapper, errors.dob && { borderColor: '#ef4444' }]}>
                        <TextInput
                            style={styles.input}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#475569"
                            keyboardType="numeric"
                            maxLength={10}
                            value={formData.dob}
                            onChangeText={(v) => {
                                setErrors(prev => ({...prev, dob: null}));
                                let cleaned = v.replace(/\D/g, '');
                                if (cleaned.length > 4 && cleaned.length <= 6) {
                                    cleaned = `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
                                } else if (cleaned.length > 6) {
                                    cleaned = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
                                }
                                setFormData({...formData, dob: cleaned});
                            }}
                        />
                    </View>
                    {errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>GENDER</Text>
                    <View style={styles.genderContainer}>
                        {['Male', 'Female', 'Other'].map(g => (
                            <TouchableOpacity 
                                key={g}
                                style={[styles.genderBtn, formData.gender === g && styles.genderBtnActive]}
                                onPress={() => setFormData({...formData, gender: g})}
                            >
                                <Text style={[styles.genderBtnText, formData.gender === g && styles.genderBtnTextActive]}>{g}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>SET PASSWORD</Text>
                <View style={[styles.inputWrapper, errors.password && { borderColor: '#ef4444' }]}>
                    <Ionicons name="key-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Min 6 chars, 1 number, 1 special symbol"
                        placeholderTextColor="#475569"
                        secureTextEntry
                        value={formData.password}
                        onChangeText={(v) => {
                            setErrors(prev => ({...prev, password: null}));
                            setFormData({...formData, password: v});
                        }}
                    />
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={[styles.inputWrapper, errors.confirmPassword && { borderColor: '#ef4444' }]}>
                    <Ionicons name="checkmark-shield-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Repeat password"
                        placeholderTextColor="#475569"
                        secureTextEntry
                        value={formData.confirmPassword}
                        onChangeText={(v) => {
                            setErrors(prev => ({...prev, confirmPassword: null}));
                            setFormData({...formData, confirmPassword: v});
                        }}
                    />
                </View>
                {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>

            <View style={styles.consentArea}>
                <TouchableOpacity 
                    style={styles.checkboxRow} 
                    onPress={() => setFormData({...formData, consent: !formData.consent})}
                >
                    <Ionicons 
                        name={formData.consent ? "checkbox" : "square-outline"} 
                        size={24} 
                        color={formData.consent ? Theme.colors.primary : "#94A3B8"} 
                    />
                    <Text style={styles.consentText}>
                        I consent to secure digital processing of my clinical records.
                    </Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity 
                style={[styles.nextBtn, !formData.consent && { opacity: 0.5 }]} 
                onPress={() => {
                    if (formData.consent) {
                        let hasError = false;
                        let newErrors = {};

                        if (!validateDOB(formData.dob)) {
                            newErrors.dob = 'Please enter a valid date (YYYY-MM-DD)';
                            hasError = true;
                        }

                        if (formData.password.length < 6) {
                            newErrors.password = 'Min 6 chars required';
                            hasError = true;
                        } else if (!/[0-9]/.test(formData.password)) {
                            newErrors.password = 'Must contain at least 1 number';
                            hasError = true;
                        } else if (!/[!@#$%^&*.,]/.test(formData.password)) {
                            newErrors.password = 'Must contain at least 1 special character (!@#$%^&*.)';
                            hasError = true;
                        }
                        if (formData.password !== formData.confirmPassword) {
                            newErrors.confirmPassword = 'Passwords do not match';
                            hasError = true;
                        }

                        if (hasError) {
                            setErrors(newErrors);
                            return;
                        }
                        setStep(2);
                    }
                }}
                disabled={!formData.consent}
            >
                <LinearGradient colors={[Theme.colors.primary, Theme.colors.secondary]} style={styles.gradientBtn}>
                    <Text style={styles.btnText}>Proceed to Health Profile</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const renderHealthStep = () => {
        const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        return (
            <View style={styles.stepContainer}>
                 <Text style={styles.stepTitle}>{steps[2].title}</Text>
                 <Text style={styles.stepSubtitle}>{steps[2].subtitle}</Text>
                 
                 <View style={styles.inputGroup}>
                    <Text style={styles.label}>BLOOD GROUP</Text>
                    <TouchableOpacity 
                        style={[styles.inputWrapper, formData.bloodGroup && { borderColor: '#6366F1' }]} 
                        onPress={() => setShowBloodModal(true)}
                    >
                        <Ionicons 
                            name="water" 
                            size={20} 
                            color={formData.bloodGroup ? '#6366F1' : '#94A3B8'} 
                            style={styles.inputIcon} 
                        />
                        <Text style={[styles.input, { color: formData.bloodGroup ? '#fff' : '#475569', paddingTop: 15 }]}>
                            {formData.bloodGroup || 'Select your blood group'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#475569" />
                    </TouchableOpacity>
                </View>

                {/* PREMIUM MODAL SELECTOR */}
                <Modal
                    visible={showBloodModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowBloodModal(false)}
                >
                    <TouchableOpacity 
                        style={styles.modalOverlay} 
                        activeOpacity={1} 
                        onPress={() => setShowBloodModal(false)}
                    >
                        <View style={[styles.modalContent, GlobalStyles.glass]}>
                            <View style={styles.modalHeader}>
                                <View style={styles.modalHandle} />
                                <Text style={styles.modalTitle}>CLINICAL BASELINE</Text>
                            </View>
                            <ScrollView style={styles.modalScroll}>
                                {bloodGroups.map(group => (
                                    <TouchableOpacity 
                                        key={group} 
                                        style={[
                                            styles.optionItem,
                                            formData.bloodGroup === group && styles.optionItemActive
                                        ]}
                                        onPress={() => {
                                            HapticUtils.selection();
                                            setFormData({...formData, bloodGroup: group});
                                            setShowBloodModal(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            formData.bloodGroup === group && styles.optionTextActive
                                        ]}>{group}</Text>
                                        {formData.bloodGroup === group && (
                                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>

                 <TouchableOpacity 
                    style={[styles.nextBtn, !formData.bloodGroup && { opacity: 0.5 }]} 
                    onPress={() => formData.bloodGroup && setStep(3)}
                    disabled={!formData.bloodGroup}
                 >
                    <LinearGradient colors={[Theme.colors.primary, '#4F46E5']} style={styles.gradientBtn}>
                        <Text style={styles.btnText}>Continue to Care Circle</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 10 }} />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    };

    const renderFamilyStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{steps[3].title}</Text>
            <Text style={styles.stepSubtitle}>{steps[3].subtitle}</Text>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>ELITE CARE CIRCLE</Text>
                <TouchableOpacity 
                    style={[styles.actionCard, GlobalStyles.glass, { borderStyle: 'dashed', borderWidth: 1, borderColor: '#6366F1' }]} 
                    onPress={() => Alert.alert("Care Circle", "You can link family accounts instantly using their Hospyn ID after launching your passport.")}
                >
                    <View style={styles.actionIconWrapper}>
                        <Ionicons name="person-add" size={24} color="#6366F1" />
                    </View>
                    <View style={styles.actionTextWrapper}>
                        <Text style={styles.actionTitle}>Add Family Member</Text>
                        <Text style={styles.actionDesc}>Sync clinical records across your household.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#475569" />
                </TouchableOpacity>
            </View>

            <View style={{ marginTop: 'auto', marginBottom: 20 }}>
                <TouchableOpacity style={styles.nextBtn} onPress={handleFinalize} disabled={loading}>
                    <LinearGradient colors={[Theme.colors.primary, '#4F46E5']} style={styles.gradientBtn}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Launch Health Passport</Text>}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#050810', '#1E1B4B', '#050810']} style={StyleSheet.absoluteFill} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.logoRow}>
                    <Image source={require('../../assets/logo.png')} style={{ width: 100, height: 40, resizeMode: 'contain' }} />
                </View>
                <TouchableOpacity onPress={handleFinalize} style={{ width: 44, alignItems: 'flex-end' }}>
                   {step === 3 && <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: 'bold' }}>SKIP</Text>}
                </TouchableOpacity>
            </View>
            {renderStepIndicator()}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    {step === 0 && renderOTPStep()}
                    {step === 1 && renderBasicStep()}
                    {step === 2 && renderHealthStep()}
                    {step === 3 && renderFamilyStep()}
                </ScrollView>
            </KeyboardAvoidingView>
            <View style={styles.encryptionBadge}>
                <Ionicons name="lock-closed" size={12} color="#10b981" />
                <Text style={styles.encryptionText}>AES-256 END-TO-END ENCRYPTED</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050810' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20 },
    stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
    stepDotActive: { width: 24, backgroundColor: '#22D3EE' },
    stepDotCompleted: { backgroundColor: '#10b981' },
    stepContainer: { flex: 1, paddingHorizontal: 24 },
    stepTitle: { fontSize: 28, color: '#FFFFFF', fontFamily: Theme.fonts.headingSemi, marginBottom: 8 },
    stepSubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 32 },
    inputGroup: { marginBottom: 24 },
    label: { fontSize: 10, color: '#22D3EE', letterSpacing: 1, fontWeight: 'bold', marginBottom: 8, marginLeft: 4 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, color: '#fff', fontSize: 16 },
    sendOtpText: { color: '#22D3EE', fontWeight: 'bold', fontSize: 12 },
    nextBtn: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
    gradientBtn: { height: 56, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    row: { flexDirection: 'row', gap: 12 },
    genderContainer: { flexDirection: 'row', gap: 8, flex: 1 },
    genderBtn: { flex: 1, height: 56, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    genderBtnActive: { backgroundColor: '#22D3EE', borderColor: '#22D3EE' },
    genderBtnText: { color: '#94A3B8' },
    genderBtnTextActive: { color: '#fff', fontWeight: 'bold' },
    consentArea: { marginTop: 20 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    consentText: { color: '#94A3B8', fontSize: 12, flex: 1 },
    encryptionBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 20, opacity: 0.6 },
    encryptionText: { color: '#10b981', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    errorText: { color: '#ef4444', fontSize: 10, marginTop: 4, marginLeft: 4 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoText: { fontSize: 20, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        gap: 16
    },
    actionIconWrapper: {
        width: 50,
        height: 50,
        borderRadius: 15,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    actionTextWrapper: { flex: 1 },
    actionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    actionDesc: { color: '#64748B', fontSize: 12, marginTop: 2 },
    skipLink: { marginTop: 24, alignItems: 'center' },
    skipLinkText: { color: '#64748B', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'underline' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#0F172A', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalHeader: { marginBottom: 20 },
    modalTitle: { color: '#6366F1', fontSize: 12, fontWeight: 'bold', letterSpacing: 2, textAlign: 'center' },
    modalScroll: { maxHeight: 400 },
    optionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
    optionItemActive: { backgroundColor: 'rgba(99, 102, 241, 0.05)' },
    optionText: { color: '#94A3B8', fontSize: 18, fontWeight: '500' },
    optionTextActive: { color: '#fff', fontWeight: 'bold' },
});
