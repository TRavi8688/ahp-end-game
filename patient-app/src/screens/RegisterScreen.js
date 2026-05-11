import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput,
    TouchableOpacity, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView, Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { SecurityUtils } from '../utils/security';
import { API_BASE_URL } from '../api';

export default function RegisterScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        age: '',
        gender: '',
        bloodGroup: '',
        abhaNumber: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState(1); // 1: Details, 2: OTP
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const onChangeDate = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate && event.type !== 'dismissed') {
            setFormData({ ...formData, age: selectedDate.toISOString().split('T')[0] });
        }
    };

    const handleNext = async () => {
        const { fullName, phone, password, confirmPassword } = formData;
        if (!fullName || !phone || !password || !confirmPassword) return Alert.alert('Missing Info', 'Please fill in Name, Phone, and Password.');
        if (phone.length < 10) return Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
        const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*.,+=\-_]).{6,}$/;
        if (!passwordRegex.test(password)) {
            return Alert.alert('Weak Password', 'Password must be at least 6 characters and include 1 number and 1 special character.');
        }
        if (password !== confirmPassword) return Alert.alert('Mismatch', 'Passwords do not match.');

        setLoading(true);
        try {
            // Instant Check for already registered users
            const checkResp = await axios.get(`${API_BASE_URL}/auth/check-user?identifier=${phone}`);
            if (checkResp.data.exists) {
                setLoading(false);
                return Alert.alert(
                    'Already Registered',
                    'This phone number is already linked to an account. Please login instead.',
                    [{ text: 'Go to Login', onPress: () => navigation.navigate('Login') }, { text: 'Change Number', style: 'cancel' }]
                );
            }

            // Register the user first so they exist in the DB for OTP verification
            const names = fullName.split(' ');
            await axios.post(`${API_BASE_URL}/auth/register`, {
                email: phone,
                password: password,
                first_name: names[0] || 'Unknown',
                last_name: names.length > 1 ? names.slice(1).join(' ') : 'Unknown',
                role: 'patient'
            });

            // Then send OTP
            await axios.post(`${API_BASE_URL}/auth/send-otp`, { identifier: phone, country_code: '+91', method: 'sms' });
            setStep(2);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally { setLoading(false); }
    };

    const handleVerifyOtp = async () => {
        if (!otp) return Alert.alert('Enter OTP', 'Please enter the 6-digit code sent to your phone.');
        setLoading(true);
        try {
            const resp = await axios.post(`${API_BASE_URL}/auth/verify-otp?email=${formData.phone}&otp=${otp}`);
            const { access_token } = resp.data;

            // Immediately complete profile setup
            const names = formData.fullName.split(" ");
            const firstName = names[0] || "Unknown";
            const lastName = names.length > 1 ? names.slice(1).join(" ") : "";

            const setupPayload = {
                phone_number: formData.phone,
                first_name: firstName,
                last_name: lastName,
                date_of_birth: formData.age || null,
                gender: formData.gender || "Unknown",
                blood_group: "Unknown",
                abha_number: null,
                password: formData.password,
                conditions: [],
                medications: []
            };

            const setupResp = await axios.post(`${API_BASE_URL}/profile/setup`, setupPayload, {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            const hospyn_id = setupResp.data.hospyn_id;
            await SecurityUtils.saveToken(access_token);
            await SecurityUtils.saveHospynId(hospyn_id);

            // Navigate to Success Screen instead of Main Dashboard
            navigation.replace('RegistrationSuccess', { hospyn_id, fullName: formData.fullName });

        } catch (err) {
            console.error(err);
            Alert.alert('Verification Failed', 'Incorrect OTP. Try 000000.');
        } finally { setLoading(false); }
    };

    return (
        <LinearGradient colors={['#050810', '#1E1B4B', '#050810']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                    <View style={styles.welcomeContainer}>
                        <Image source={require('../../assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
                        <Text style={styles.title}>Join Hospyn</Text>
                        <Text style={styles.subtitle}>Create your AI Health Passport in seconds.</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{step === 1 ? 'Basic Details' : 'Verify Phone'}</Text>

                        {step === 1 ? (
                            <>
                                <View style={styles.inputBox}>
                                    <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Full Name"
                                        value={formData.fullName}
                                        onChangeText={(v) => setFormData({ ...formData, fullName: v })}
                                        placeholderTextColor="#aaa"
                                    />
                                </View>
                                <View style={styles.inputBox}>
                                    <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Mobile Number"
                                        value={formData.phone}
                                        onChangeText={(v) => setFormData({ ...formData, phone: v })}
                                        keyboardType="phone-pad"
                                        maxLength={10}
                                        placeholderTextColor="#aaa"
                                    />
                                </View>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={[styles.inputBox, { flex: 1 }]}>
                                        {Platform.OS === 'web' ? (
                                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name="calendar-outline" size={18} color="#666" style={{ marginRight: 8 }} />
                                                <input
                                                    type="date"
                                                    value={formData.age}
                                                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                                    style={{
                                                        backgroundColor: 'transparent',
                                                        border: 'none',
                                                        color: '#FFFFFF',
                                                        fontSize: '14px',
                                                        outline: 'none',
                                                        width: '100%',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                            </View>
                                        ) : (
                                            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ flex: 1, height: '100%', justifyContent: 'center' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Ionicons name="calendar-outline" size={18} color="#666" style={{ marginRight: 8 }} />
                                                    <Text style={{ fontSize: 14, color: formData.age ? '#FFFFFF' : '#aaa' }}>
                                                        {formData.age ? formData.age : 'Date of Birth'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                        {showDatePicker && Platform.OS !== 'web' && (
                                            <DateTimePicker
                                                value={formData.age ? new Date(formData.age) : new Date()}
                                                mode="date"
                                                display="default"
                                                maximumDate={new Date()}
                                                onChange={onChangeDate}
                                            />
                                        )}
                                    </View>
                                    <View style={[styles.inputBox, { flex: 0.8, paddingHorizontal: 5 }]}>
                                        <Picker
                                            selectedValue={formData.gender}
                                            onValueChange={(v) => setFormData({ ...formData, gender: v })}
                                            style={{ flex: 1, color: formData.gender ? '#FFFFFF' : '#aaa' }}
                                            dropdownIconColor="#94A3B8"
                                            mode="dropdown"
                                        >
                                            <Picker.Item label="Gender" value="" color="#475569" />
                                            <Picker.Item label="Male" value="Male" color="#1f2937" />
                                            <Picker.Item label="Female" value="Female" color="#1f2937" />
                                            <Picker.Item label="Other" value="Other" color="#1f2937" />
                                        </Picker>
                                    </View>
                                </View>
                                <View style={styles.inputBox}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Password (6+ chars, 1 symb, 1 num)"
                                        value={formData.password}
                                        onChangeText={(v) => setFormData({ ...formData, password: v })}
                                        secureTextEntry={!showPassword}
                                        placeholderTextColor="#aaa"
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 10 }}>
                                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.inputBox}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirm Password"
                                        value={formData.confirmPassword}
                                        onChangeText={(v) => setFormData({ ...formData, confirmPassword: v })}
                                        secureTextEntry={!showPassword}
                                        placeholderTextColor="#aaa"
                                    />
                                    {formData.confirmPassword.length > 0 && (
                                        <Ionicons 
                                            name={formData.password === formData.confirmPassword ? "checkmark-circle" : "close-circle"} 
                                            size={20} 
                                            color={formData.password === formData.confirmPassword ? "#10b981" : "#ef4444"} 
                                            style={{ marginRight: 10 }}
                                        />
                                    )}
                                </View>
                                {formData.confirmPassword.length > 0 && (
                                    <Text style={{ 
                                        color: formData.password === formData.confirmPassword ? "#10b981" : "#ef4444", 
                                        fontSize: 12, 
                                        marginTop: -10, 
                                        marginBottom: 10,
                                        marginLeft: 10,
                                        fontWeight: 'bold'
                                    }}>
                                        {formData.password === formData.confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                                    </Text>
                                )}
                            </>
                        ) : (
                            <View>
                                <View style={styles.inputBox}>
                                    <Ionicons name="key-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter 6-digit OTP"
                                        value={otp}
                                        onChangeText={setOtp}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        placeholderTextColor="#475569"
                                    />
                                </View>
                                <Text style={{ color: '#6366F1', fontSize: 12, textAlign: 'center', marginBottom: 10, opacity: 0.8 }}>
                                    Hint: Use 000000 for instant verification
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={step === 1 ? handleNext : handleVerifyOtp}
                            disabled={loading}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <>
                                    <Text style={styles.buttonText}>{step === 1 ? 'Next' : 'Verify & Finish'}</Text>
                                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 10 }} />
                                </>
                            }
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
                            <Text style={styles.loginLinkText}>Already have an account? <Text style={{ fontWeight: 'bold' }}>Login</Text></Text>
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.divider} />
                        </View>

                        <View style={styles.socialContainer}>
                            <TouchableOpacity style={styles.socialBtn} onPress={() => {
                                if (Platform.OS === 'web') alert('Coming Soon: Google Signup is being integrated!');
                                else Alert.alert('Coming Soon', 'Google Signup is being integrated!');
                            }}>
                                <Ionicons name="logo-google" size={24} color="#EA4335" />
                                <Text style={styles.socialBtnText}>Sign Up with Google</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.footerText}>Secure • Private • Hospyn</Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050810' },
    content: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    welcomeContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logoImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 15,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: 2,
    },
    subtitle: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
        paddingHorizontal: 20,
        letterSpacing: 1,
    },
    card: {
        width: '100%',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 14,
        height: 56,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    inputIcon: { marginRight: 12 },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#FFFFFF',
    },
    button: {
        backgroundColor: '#6366F1',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    loginLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    loginLinkText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    footerText: {
        marginTop: 40,
        color: 'rgba(255,255,255,0.2)',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 2,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
        gap: 12,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    dividerText: {
        color: '#475569',
        fontSize: 14,
    },
    socialContainer: {
        width: '100%',
    },
    socialBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        gap: 12,
    },
    socialBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    }
});
