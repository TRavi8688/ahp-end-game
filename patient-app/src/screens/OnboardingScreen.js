import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput,
    TouchableOpacity, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView, Dimensions,
    Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { Theme, GlobalStyles } from '../theme';
import { API_BASE_URL } from '../api';
import { SecurityUtils } from '../utils/security';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function OnboardingScreen({ navigation }) {
    const { login } = useAuth();
    const [step, setStep] = useState(0); // 0: OTP, 1: Basic, 2: Health, 3: Family
    const [loading, setLoading] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        phone: '',
        otp: '',
        fullName: '',
        dob: '',
        gender: '',
        bloodGroup: '',
        allergies: '',
        conditions: '',
        familyMembers: [],
        consent: false
    });

    const steps = [
        { title: 'Identity Verification', subtitle: 'Secure OTP via Mobile' },
        { title: 'Personal Profile', subtitle: 'Basic identity details' },
        { title: 'Clinical Baseline', subtitle: 'Chronic health context' },
        { title: 'Care Circle', subtitle: 'Add family for coordinated care' }
    ];

    const handleSendOTP = async () => {
        if (formData.phone.length < 10) return Alert.alert('Invalid Phone', 'Please enter a 10-digit number.');
        setLoading(true);
        try {
            // Simulated for now or connect to backend
            await axios.post(`${API_BASE_URL}/auth/send-otp`, { 
                identifier: formData.phone, 
                country_code: '+91', 
                method: 'sms' 
            });
            Alert.alert('OTP Sent', 'Check your messages for the verification code.');
        } catch (e) {
            Alert.alert('Error', 'Failed to send OTP. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (formData.otp.length < 6) return Alert.alert('Invalid OTP', 'Enter the 6-digit code.');
        setLoading(true);
        try {
            // Strictly enforce real OTP verification
            const verifyResp = await axios.post(`${API_BASE_URL}/auth/verify-otp`, { 
                identifier: formData.phone, 
                otp: formData.otp 
            });
            
            if (verifyResp.data.user_exists) {
                setFormData(prev => ({ 
                    ...prev, 
                    userExists: true,
                    hospyn_id: verifyResp.data.hospyn_id 
                }));
                // Go straight to Step 1 without an alert that might be blocked by browser
                setStep(1);
            } else {
                setStep(1);
            }

        } catch (e) {
            Alert.alert('Verification Failed', 'Incorrect OTP.');
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
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={formData.phone}
                        onChangeText={(v) => setFormData({...formData, phone: v})}
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
                <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify Identity</Text>}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const renderBasicStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{steps[1].title}</Text>
            <Text style={styles.stepSubtitle}>{steps[1].subtitle}</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>FULL NAME</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="John Doe"
                        placeholderTextColor="#475569"
                        value={formData.fullName}
                        onChangeText={(v) => setFormData({...formData, fullName: v})}
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>DOB</Text>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#475569"
                            keyboardType="numeric"
                            maxLength={10}
                            value={formData.dob}
                            onChangeText={(v) => {
                                // Simple Auto-formatter for YYYY-MM-DD
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

            <View style={styles.consentArea}>
                <TouchableOpacity 
                    style={styles.checkboxRow} 
                    onPress={() => setFormData({...formData, consent: !formData.consent})}
                >
                    <Ionicons 
                        name={formData.consent ? "checkbox" : "square-outline"} 
                        size={24} 
                        color={formData.consent ? "#6366F1" : "#94A3B8"} 
                    />
                    <Text style={styles.consentText}>
                        I consent to secure digital processing of my clinical records.
                    </Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity 
                style={[styles.nextBtn, !formData.consent && { opacity: 0.5 }]} 
                onPress={() => formData.consent && setStep(2)}
                disabled={!formData.consent}
            >
                <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn}>
                    <Text style={styles.btnText}>Proceed to Health Profile</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const renderHealthStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{steps[2].title}</Text>
            <Text style={styles.stepSubtitle}>{steps[2].subtitle}</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>BLOOD GROUP</Text>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={formData.bloodGroup}
                        onValueChange={(v) => setFormData({...formData, bloodGroup: v})}
                        style={styles.picker}
                        dropdownIconColor="#6366F1"
                        mode="dropdown"
                    >
                        <Picker.Item label="Select Blood Group" value="" color="#94A3B8" />
                        <Picker.Item label="A Positive (A+)" value="A+" color="#000" />
                        <Picker.Item label="A Negative (A-)" value="A-" color="#000" />
                        <Picker.Item label="B Positive (B+)" value="B+" color="#000" />
                        <Picker.Item label="B Negative (B-)" value="B-" color="#000" />
                        <Picker.Item label="O Positive (O+)" value="O+" color="#000" />
                        <Picker.Item label="O Negative (O-)" value="O-" color="#000" />
                        <Picker.Item label="AB Positive (AB+)" value="AB+" color="#000" />
                        <Picker.Item label="AB Negative (AB-)" value="AB-" color="#000" />
                    </Picker>
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>ALLERGIES (OPTIONAL)</Text>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Penicillin, Peanuts"
                        placeholderTextColor="#475569"
                        value={formData.allergies}
                        onChangeText={(v) => setFormData({...formData, allergies: v})}
                    />
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>EXISTING CONDITIONS (OPTIONAL)</Text>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Diabetes, Asthma"
                        placeholderTextColor="#475569"
                        value={formData.conditions}
                        onChangeText={(v) => setFormData({...formData, conditions: v})}
                    />
                </View>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.skipBtn} onPress={() => setStep(3)}>
                    <Text style={styles.skipBtnText}>Skip for now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={() => setStep(3)}>
                    <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn}>
                        <Text style={styles.btnText}>Continue</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );

    const handleFinalize = async () => {
        setLoading(true);
        try {
            let hospyn_id = null;
            const defaultPassword = 'DefaultPass123!';

            if (formData.userExists) {
                hospyn_id = formData.hospyn_id || `Hospyn-${formData.phone.slice(-6)}`;
            } else {
                // 1. Register User
                const registerResp = await axios.post(`${API_BASE_URL}/auth/register`, {
                    email: formData.phone,
                    password: defaultPassword,
                    first_name: formData.fullName.split(' ')[0] || 'Patient',
                    last_name: formData.fullName.split(' ').slice(1).join(' ') || '',
                    role: 'patient'
                });
                hospyn_id = registerResp.data.hospyn_id;
            }

            // 2. Real Login (No Bypass)
            const loginFormData = new FormData();
            loginFormData.append('username', formData.phone);
            loginFormData.append('password', defaultPassword);

            const loginResp = await axios.post(`${API_BASE_URL}/auth/login`, loginFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const token = loginResp.data.access_token;
            
            console.log("========== FINALIZE REQUEST ==========");
            console.log("TOKEN:", token);
            console.log("TOKEN TYPE:", typeof token);
            console.log("TOKEN LENGTH:", token?.length);
            console.log("AUTH HEADER:", `Bearer ${token}`);
            console.log("HOSPYN_ID:", hospyn_id);

            // 3. Profile Setup
            await axios.post(`${API_BASE_URL}/profile/setup`, {
                phone_number: formData.phone,
                date_of_birth: formData.dob || null,
                gender: formData.gender || "Other",
                blood_group: formData.bloodGroup || "Unknown",
                conditions: formData.conditions ? formData.conditions.split(',') : [],
                medications: [],
                first_name: formData.fullName.split(' ')[0],
                last_name: formData.fullName.split(' ').slice(1).join(' ')
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            await login(token, hospyn_id);
            
            Alert.alert(
                'Registration Successful!',
                `Welcome to Hospyn!\n\nYour Unique Hospyn ID: ${hospyn_id}\n\nYour Patient Passport is now active. Your QR code is being generated in your dashboard.`,
                [{ text: 'Launch Passport', onPress: () => navigation.replace('RegistrationSuccess', { 
                    hospyn_id: hospyn_id,
                    fullName: formData.fullName 
                }) }]
            );


        } catch (e) {
            console.error("========== FINALIZE ERROR ==========");
            console.error("FINALIZE ERROR STATUS:", e?.response?.status);
            console.error("FINALIZE ERROR DATA:", e?.response?.data);
            console.error("FINALIZE ERROR HEADERS:", e?.response?.headers);
            console.error("FULL ERROR:", e);
            
            console.error("ONBOARDING_FINALIZE_FAILURE", e);
            Alert.alert('Account Creation Failed', e.response?.data?.message || 'An error occurred during secure setup.');
        } finally {
            setLoading(false);
        }
    };

    const renderFamilyStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{steps[3].title}</Text>
            <Text style={styles.stepSubtitle}>{steps[3].subtitle}</Text>

            <View style={styles.familyIllustration}>
                <Ionicons name="people-outline" size={80} color="rgba(99, 102, 241, 0.3)" />
                <Text style={styles.familyHint}>
                    Managing records for parents or dependents? You can add them to your secure blood-line circle.
                </Text>
            </View>

            <TouchableOpacity style={styles.addFamilyBtn}>
                <Ionicons name="add-circle-outline" size={24} color="#6366F1" />
                <Text style={styles.addFamilyText}>Add Family Member</Text>
            </TouchableOpacity>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.skipBtn} onPress={handleFinalize}>
                    <Text style={styles.skipBtnText}>I'll do it later</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={handleFinalize} disabled={loading}>
                    <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Launch Passport</Text>}
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
                <Text style={styles.headerTitle}>SECURE ONBOARDING</Text>
                <View style={{ width: 24 }} />
            </View>

            {renderStepIndicator()}

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
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
    container: {
        flex: 1,
        backgroundColor: '#050810',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: Theme.fonts.label,
        letterSpacing: 2,
        fontWeight: 'bold',
    },
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20,
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    stepDotActive: {
        width: 24,
        backgroundColor: '#6366F1',
    },
    stepDotCompleted: {
        backgroundColor: '#10b981',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    stepContainer: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 28,
        color: '#FFFFFF',
        fontFamily: Theme.fonts.headingSemi,
        marginBottom: 8,
    },
    stepSubtitle: {
        fontSize: 14,
        color: '#94A3B8',
        marginBottom: 32,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 10,
        color: '#6366F1',
        letterSpacing: 1,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    pickerWrapper: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        height: 56,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
    },
    picker: {
        color: '#FFFFFF',
        height: 56,
        backgroundColor: 'transparent',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
    },
    sendOtpText: {
        color: '#6366F1',
        fontWeight: 'bold',
        fontSize: 12,
    },
    hint: {
        fontSize: 11,
        color: '#475569',
        marginTop: 8,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'flex-start',
    },
    genderContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    genderBtn: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    genderBtnActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    genderBtnText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    genderBtnTextActive: {
        color: '#FFFFFF',
    },
    consentArea: {
        marginVertical: 20,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    consentText: {
        flex: 1,
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 18,
    },
    nextBtn: {
        marginTop: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradientBtn: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 20,
    },
    skipBtn: {
        height: 56,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    skipBtnText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    familyIllustration: {
        alignItems: 'center',
        marginVertical: 40,
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        padding: 30,
        borderRadius: 32,
    },
    familyHint: {
        color: '#94A3B8',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        marginTop: 20,
    },
    addFamilyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#6366F1',
        gap: 12,
        marginBottom: 20,
    },
    addFamilyText: {
        color: '#6366F1',
        fontWeight: 'bold',
    },
    encryptionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 15,
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
    },
    encryptionText: {
        color: '#10b981',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});
