import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput,
    TouchableOpacity, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView, Dimensions,
    Image, Animated, Easing, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../contexts/AuthContext';
import { Theme } from '../theme';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../api';
import { authService } from '../services/authService';
import { patientService } from '../services/patientService';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

const { width, height } = Dimensions.get('window');

export default function AuthScreen({ navigation }) {
    const { login, setNeedsPasswordSetup } = useAuth();

    // Auth States
    const [hospynId, setHospynId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('login'); // Fallback mode state to prevent undefined errors

    // Google Login States
    

    // Frictionless Setup Profile States
    const [setupModalVisible, setSetupModalVisible] = useState(false);
    const [setupFirstName, setSetupFirstName] = useState('');
    const [setupLastName, setSetupLastName] = useState('');
    const [setupPhone, setSetupPhone] = useState('');
    const [setupDob, setSetupDob] = useState('');
    const [setupGender, setSetupGender] = useState('Male');
    const [setupBloodGroup, setSetupBloodGroup] = useState('Unknown'); // Changed default to 'Unknown' per Skip option request
    const [setupPassword, setSetupPassword] = useState('');
    const [setupLoading, setSetupLoading] = useState(false);
    const [tempAuthToken, setTempAuthToken] = useState('');
    const [tempEmail, setTempEmail] = useState('');

    // Forgot Password States
    const [forgotModalVisible, setForgotModalVisible] = useState(false);
    const [forgotStep, setForgotStep] = useState(1); // 1: Request, 2: Verify OTP, 3: Reset Password
    const [forgotIdentifier, setForgotIdentifier] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
    const [forgotResetToken, setForgotResetToken] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);

    // --- REAL GOOGLE IDENTITY SERVICES (GSI) INTEGRATION ---
    useEffect(() => {
        if (Platform.OS === 'web') {
            // 1. Inject GSI Script
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            document.body.appendChild(script);

            script.onload = () => {
                if (window.google) {
                    // Initialize with production Google OAuth Web Client ID
                    window.google.accounts.id.initialize({
                        client_id: GOOGLE_CLIENT_ID,
                        callback: async (response) => {
                            // REAL Google Identity Token (JWT) returned from popup!
                            setLoading(true);
                            try {
                                // 1. Verify token with your FastAPI backend /auth/google endpoint
                                const data = await authService.googleLogin(response.credential);
                                const { access_token } = data;

                                // Decode user email from Google JWT payload safely
                                let email = 'google.user@hospyn.com';
                                try {
                                    const payloadBase64 = response.credential.split('.')[1];
                                    const decoded = JSON.parse(atob(payloadBase64));
                                    email = decoded.email || email;
                                } catch (err) {}

                                // 2. Check patient profile status
                                try {
                                    // Make sure we pass the token to SecurityUtils or temporary state to make the API call work
                                    // Note: In an ideal world, the apiClient handles this via SecurityUtils.
                                    // For this manual step during login, we might temporarily inject it.
                                    // But since we just want to verify if profile exists, authService can do it or we just use raw axios for this specific check if apiClient isn't hydrated yet.
                                    // Wait, let's just mock the check or use a temporary apiClient request.
                                    // For now, use the old axios approach for this specific one-off check just to be safe before login finishes
                                    const profileResp = await axios.get(`${API_BASE_URL}/patients/me`, {
                                        headers: { 'Authorization': `Bearer ${access_token}` }
                                    });
                                    await AsyncStorage.removeItem('mock_profile');
                                    await login(access_token, email, null, 'google');
                                    // FIX (2026-06-23): tell the app this account can't use
                                    // Hospyn ID + password yet, so it can offer a one-time
                                    // "set up a password" prompt instead of forcing Google
                                    // sign-in forever.
                                    if (data.has_usable_password === false) {
                                        setNeedsPasswordSetup(true);
                                    }
                                } catch (profileErr) {
                                    if (profileErr.response?.status === 404) {
                                        setTempAuthToken(access_token);
                                        setTempEmail(email);
                                        setSetupModalVisible(true);
                                    } else if (profileErr.response?.status === 403) {
                                        Alert.alert(
                                            'Access Denied', 
                                            'This Google account is registered as a Doctor/Staff. This application is strictly for personal health accounts. Please use a different email to create a member account.'
                                        );
                                        throw new Error("Handled403");
                                    } else {
                                        throw profileErr;
                                    }
                                }
                            } catch (e) {
                                if (e.message !== "Handled403") {
                                    const errorMsg = e.response?.data?.message || e.response?.data?.detail || 'Google Auth verification failed.';
                                    Alert.alert('Google Authentication Error', errorMsg);
                                }
                            } finally {
                                setLoading(false);
                            }
                        }
                    });

                    // Define rendering function safely
                    window.renderGoogleButton = () => {
                        const container = document.getElementById('real-google-btn-container');
                        if (container && window.google) {
                            window.google.accounts.id.renderButton(container, {
                                theme: 'filled_blue',
                                size: 'large',
                                width: width > 400 ? 340 : 280,
                                shape: 'pill'
                            });
                        }
                    };
                    window.renderGoogleButton();
                }
            };

            return () => {
                try {
                    document.body.removeChild(script);
                } catch (e) {}
            };
        }
    }, []);

    // Re-render Google button when switching between login/landing mode
    useEffect(() => {
        if (Platform.OS === 'web' && window.renderGoogleButton) {
            setTimeout(window.renderGoogleButton, 150);
        }
    }, [mode]);

    // After successful login, the AuthContext flips isAuthenticated, and
    // App.js swaps the whole navigator from the unauthenticated stack to
    // MainTabs on its own — no manual navigation needed here.
    //
    // BUG FIX (this was the #1 cause of "random login failures"): this
    // function used to also call navigation.replace('Home') right after
    // login(). But 'Home' isn't a screen in *this* stack (it's a tab name
    // nested inside MainTabs), and by the time this line ran, the stack had
    // often already swapped away from Login because of the isAuthenticated
    // change above — so navigation.replace('Home') threw a navigation error.
    // That error was caught by the caller's try/catch and shown to the user
    // as "Login Failed: Invalid credentials" even though login had already
    // succeeded and the token was already saved. Removing it fixes that.
    const handleLoginSuccess = async (accessToken, identifier) => {
        await AsyncStorage.removeItem('mock_profile');
        await login(accessToken, identifier);
    };

    const handleHospynLogin = async () => {
        if (!hospynId || !password) return Alert.alert('Missing Info', 'Please enter your Hospyn ID and Password.');
        setLoading(true);
        try {
            const identifier = hospynId.trim();
            const data = await authService.login(identifier, password);
            if (data.access_token) {
                await handleLoginSuccess(data.access_token, identifier);
            }
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.response?.data?.detail || 'Invalid credentials.';
            Alert.alert('Login Failed', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // Native Apple Login Handler
    const handleAppleLogin = async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });
            
            setLoading(true);
            try {
                // Pass identity token to backend to verify and mint Hospyn token
                const data = await authService.appleLogin(credential.identityToken);
                const { access_token } = data;
                
                // Fallback email since Apple only sends it once
                const email = credential.email || 'apple.user@hospyn.com';
                
                try {
                    const profileResp = await axios.get(`${API_BASE_URL}/patients/me`, {
                        headers: { 'Authorization': `Bearer ${access_token}` }
                    });
                    await AsyncStorage.removeItem('mock_profile');
                    await login(access_token, email, null, 'apple');
                    if (data.has_usable_password === false) {
                        setNeedsPasswordSetup(true);
                    }
                } catch (profileErr) {
                    if (profileErr.response?.status === 404) {
                        setTempAuthToken(access_token);
                        setTempEmail(email);
                        setSetupModalVisible(true);
                    } else if (profileErr.response?.status === 403) {
                        Alert.alert('Access Denied', 'This Apple account is registered as a Doctor/Staff.');
                    } else {
                        throw profileErr;
                    }
                }
            } catch (e) {
                const errorMsg = e.response?.data?.message || e.response?.data?.detail || 'Apple Auth verification failed on server.';
                Alert.alert('Apple Authentication Error', errorMsg);
            } finally {
                setLoading(false);
            }

        } catch (e) {
            if (e.code === 'ERR_REQUEST_CANCELED') {
                // User canceled
            } else {
                Alert.alert("Apple Auth Error", "Failed to sign in with Apple.");
            }
        }
    };


    

    // Callback used by the simulated/developer accounts
    

    // Submit Frictionless Profile Setup
    const handleSetupSubmit = async () => {
        const cleanFirstName = setupFirstName.trim();
        const cleanLastName = setupLastName.trim();
        const cleanPhone = setupPhone.trim();
        const cleanDob = setupDob.trim();

        if (!cleanFirstName || !cleanLastName) {
            return Alert.alert('Name Required', 'Please enter your first and last name to complete setup.');
        }

        // Phone validation
        if (!/^\d{10}$/.test(cleanPhone)) {
            return Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
        }

        // DOB YYYY-MM-DD validation
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDob)) {
            return Alert.alert('Invalid Date Format', 'Date of Birth must be in YYYY-MM-DD format.');
        }

        setSetupLoading(true);
        try {
            // FIX-P1 (2026-06-24): field names now match the real PatientCreate
            // schema (phone, not phone_number). Also: this endpoint has no
            // password field at all — setting a Hospyn ID password is a
            // separate operation now handled by the dedicated "Set up
            // password" flow (Settings, or the one-time prompt after first
            // Google sign-in), so it's no longer silently ignored here.
            const payload = {
                first_name: cleanFirstName,
                last_name: cleanLastName,
                phone: cleanPhone,
                date_of_birth: cleanDob,
                gender: setupGender ? setupGender.toLowerCase() : null,
                blood_group: setupBloodGroup || 'Unknown',
            };

            await authService.setupProfile(payload, tempAuthToken);

            // Auto-login after setup complete!
            await AsyncStorage.removeItem('mock_profile');
            await login(tempAuthToken, tempEmail);
            setSetupModalVisible(false);
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.response?.data?.detail || 'Failed to initialize health profile.';
            Alert.alert('Setup Failed', errorMsg);
        } finally {
            setSetupLoading(false);
        }
    };

    // Forgot Password Flow
    const handleForgotRequest = async () => {
        if (!forgotIdentifier) return Alert.alert('Required', 'Please enter your registered Hospyn ID or Email.');
        setForgotLoading(true);
        try {
            const data = await authService.requestForgotPassword(forgotIdentifier);
            Alert.alert('OTP Dispatched', `A 6-digit verification code has been sent to the linked email: ${data.target}`);
            setForgotStep(2);
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.response?.data?.detail || 'No account matched this identifier.';
            Alert.alert('Request Failed', errorMsg);
        } finally {
            setForgotLoading(false);
        }
    };

    const handleForgotVerify = async () => {
        if (!forgotOtp || forgotOtp.length !== 6) return Alert.alert('Required', 'Please enter a valid 6-digit OTP.');
        setForgotLoading(true);
        try {
            const data = await authService.verifyForgotPassword(forgotIdentifier, forgotOtp);
            setForgotResetToken(data.reset_token);
            setForgotStep(3);
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.response?.data?.detail || 'Invalid or expired OTP.';
            Alert.alert('Verification Failed', errorMsg);
        } finally {
            setForgotLoading(false);
        }
    };

    const handleForgotReset = async () => {
        if (!forgotNewPassword || !forgotConfirmPassword) {
            return Alert.alert('Required', 'Please fill in both password fields.');
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
            return Alert.alert('Mismatch', 'Passwords do not match.');
        }
        if (forgotNewPassword.length < 6) {
            return Alert.alert('Weak Password', 'Password must be at least 6 characters.');
        }

        setForgotLoading(true);
        try {
            await authService.resetPassword(forgotResetToken, forgotNewPassword);
            Alert.alert('Success', 'Your password has been reset successfully. You can now log in.');
            setForgotModalVisible(false);
            setForgotStep(1);
            setForgotIdentifier('');
            setForgotOtp('');
            setForgotNewPassword('');
            setForgotConfirmPassword('');
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.response?.data?.detail || 'Password reset failed.';
            Alert.alert('Reset Failed', errorMsg);
        } finally {
            setForgotLoading(false);
        }
    };


    return (
        <View style={styles.container}>
            <LinearGradient colors={['#050810', '#1E1B4B', '#050810']} style={StyleSheet.absoluteFill} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>


                    <View style={styles.card}>
                        <Text style={styles.loginTitle}>Welcome Back</Text>
                        <Text style={styles.loginSubtitle}>Access your encrypted clinical records.</Text>

                        <View style={styles.inputArea}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>HOSPYN ID / EMAIL</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="HOSPYN-000000-XXX"
                                        placeholderTextColor="#475569"
                                        value={hospynId}
                                        onChangeText={(t) => setHospynId(t)}
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>PASSWORD</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor="#475569"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity onPress={() => {
                                setForgotStep(1);
                                setForgotModalVisible(true);
                            }} style={styles.forgotLink}>
                                <Text style={styles.forgotLinkText}>Forgot Password?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.button} onPress={handleHospynLogin} disabled={loading}>
                                <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Authorize Access</Text>}
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={styles.dividerArea}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            {Platform.OS === 'web' ? (
                                <View style={{height: 48, justifyContent: 'center', alignItems: 'center', width: '100%'}}>
                                    <View id="real-google-btn-container" />
                                </View>
                            ) : (
                                <View style={{ gap: 12 }}>
                                    {Platform.OS === 'ios' && (
                                        <AppleAuthentication.AppleAuthenticationButton
                                            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                                            cornerRadius={18}
                                            style={{ height: 50, width: '100%' }}
                                            onPress={handleAppleLogin}
                                        />
                                    )}
                                    <TouchableOpacity style={[styles.googleBtn, { height: 50, borderRadius: 18 }]} onPress={() => Alert.alert('Google Sign-In', 'Native Google Auth requires separate native configuration.')}>
                                        <Ionicons name="logo-google" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                                        <Text style={styles.googleBtnText}>Continue with Google</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <Text style={styles.encryptedNotice}>
                                <Ionicons name="lock-closed" size={12} color="#94A3B8" /> End-to-end encrypted session
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            

            {/* Frictionless Setup Profile Modal */}
            <Modal visible={setupModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
                        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} style={{ width: '100%' }}>
                            <View style={styles.setupCard}>
                                <TouchableOpacity style={styles.modalCloseIcon} onPress={() => setSetupModalVisible(false)}>
                                    <Ionicons name="close" size={24} color="#FFF" />
                                </TouchableOpacity>

                                <View style={styles.setupHeader}>
                                    <Ionicons name="pulse" size={40} color="#6366F1" />
                                    <Text style={styles.setupTitle}>Complete Your Profile</Text>
                                    <Text style={styles.setupSubtitle}>Configure your encrypted clinical biometrics</Text>
                                </View>

                                <View style={styles.setupForm}>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <View style={[styles.inputGroup, { flex: 1 }]}>
                                            <Text style={styles.label}>FIRST NAME *</Text>
                                            <View style={styles.inputWrapper}>
                                                <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="John"
                                                    placeholderTextColor="#475569"
                                                    value={setupFirstName}
                                                    onChangeText={setSetupFirstName}
                                                />
                                            </View>
                                        </View>
                                        <View style={[styles.inputGroup, { flex: 1 }]}>
                                            <Text style={styles.label}>LAST NAME *</Text>
                                            <View style={styles.inputWrapper}>
                                                <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="Doe"
                                                    placeholderTextColor="#475569"
                                                    value={setupLastName}
                                                    onChangeText={setSetupLastName}
                                                />
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>MOBILE NUMBER (NO OTP REQUIRED)</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="call-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="9876543210"
                                                placeholderTextColor="#475569"
                                                value={setupPhone}
                                                onChangeText={setSetupPhone}
                                                keyboardType="phone-pad"
                                                maxLength={10}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>DATE OF BIRTH (YYYY-MM-DD)</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="calendar-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="1995-08-25"
                                                placeholderTextColor="#475569"
                                                value={setupDob}
                                                onChangeText={setSetupDob}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>GENDER</Text>
                                        <View style={styles.pillContainer}>
                                            {['Male', 'Female', 'Other'].map((g) => (
                                                <TouchableOpacity
                                                    key={g}
                                                    style={[styles.pillBtn, setupGender === g && styles.pillBtnActive]}
                                                    onPress={() => setSetupGender(g)}
                                                >
                                                    <Text style={[styles.pillText, setupGender === g && styles.pillTextActive]}>{g}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>BLOOD GROUP</Text>
                                        <View style={styles.pillContainerScroll}>
                                            {['A+', 'B+', 'AB+', 'O+', 'A-', 'B-', 'AB-', 'O-', 'Unknown'].map((bg) => (
                                                <TouchableOpacity
                                                    key={bg}
                                                    style={[styles.smallPill, setupBloodGroup === bg && styles.pillBtnActive]}
                                                    onPress={() => setSetupBloodGroup(bg)}
                                                >
                                                    <Text style={[styles.pillText, setupBloodGroup === bg && styles.pillTextActive]}>{bg}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.label, { opacity: 0.6 }]}>
                                            You can set a Hospyn ID password right after this, from Settings → "Set up Hospyn ID & password."
                                        </Text>
                                    </View>

                                    <TouchableOpacity style={styles.setupSubmitBtn} onPress={handleSetupSubmit} disabled={setupLoading}>
                                        <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn}>
                                            {setupLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Finish Setup</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Forgot Password Modal */}
            <Modal visible={forgotModalVisible} transparent animationType="fade" onRequestClose={() => setForgotModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
                        <View style={styles.setupCard}>
                            <TouchableOpacity style={styles.modalCloseIcon} onPress={() => setForgotModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>

                            <View style={styles.setupHeader}>
                                <Ionicons name="keypad-outline" size={40} color="#F59E0B" />
                                <Text style={styles.setupTitle}>Account Recovery</Text>
                                <Text style={styles.setupSubtitle}>
                                    {forgotStep === 1 && "Verify your registered phone number or email"}
                                    {forgotStep === 2 && "Enter the 6-digit OTP code sent to your account"}
                                    {forgotStep === 3 && "Secure your profile with a new password"}
                                </Text>
                            </View>

                            {forgotStep === 1 && (
                                <View style={styles.setupForm}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>REGISTERED EMAIL / HOSPYN ID</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="email@example.com or HOSPYN-ID"
                                                placeholderTextColor="#475569"
                                                value={forgotIdentifier}
                                                onChangeText={setForgotIdentifier}
                                                autoCapitalize="none"
                                            />
                                        </View>
                                    </View>
                                    <TouchableOpacity style={styles.setupSubmitBtn} onPress={handleForgotRequest} disabled={forgotLoading}>
                                        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.gradientBtn}>
                                            {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Recovery Code</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {forgotStep === 2 && (
                                <View style={styles.setupForm}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>6-DIGIT VERIFICATION CODE</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="shield-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="000000"
                                                placeholderTextColor="#475569"
                                                value={forgotOtp}
                                                onChangeText={setForgotOtp}
                                                keyboardType="number-pad"
                                                maxLength={6}
                                            />
                                        </View>
                                    </View>
                                    <TouchableOpacity style={styles.setupSubmitBtn} onPress={handleForgotVerify} disabled={forgotLoading}>
                                        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.gradientBtn}>
                                            {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP Code</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {forgotStep === 3 && (
                                <View style={styles.setupForm}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>NEW PASSWORD</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="••••••••"
                                                placeholderTextColor="#475569"
                                                value={forgotNewPassword}
                                                onChangeText={setForgotNewPassword}
                                                secureTextEntry
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="••••••••"
                                                placeholderTextColor="#475569"
                                                value={forgotConfirmPassword}
                                                onChangeText={setForgotConfirmPassword}
                                                secureTextEntry
                                            />
                                        </View>
                                    </View>
                                    <TouchableOpacity style={styles.setupSubmitBtn} onPress={handleForgotReset} disabled={forgotLoading}>
                                        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.gradientBtn}>
                                            {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Set New Password</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050810',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 60,
    },
    landingContent: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 30,
        paddingTop: 100,
        paddingBottom: 60,
    },
    landingHeader: {
        alignItems: 'center',
        marginBottom: 60,
    },
    heroLogo: {
        width: 200,
        height: 200,
    },
    landingActions: {
        gap: 16,
    },
    primaryBtn: {
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: Theme.fonts.headingSemi,
    },
    googleBtn: {
        height: 60,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    googleBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: Theme.fonts.headingSemi,
    },
    secondaryBtn: {
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    secondaryBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: Theme.fonts.headingSemi,
    },
    trustFooter: {
        alignItems: 'center',
        gap: 12,
    },
    trustItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    trustText: {
        color: '#10b981',
        fontSize: 12,
        fontFamily: Theme.fonts.label,
        fontWeight: 'bold',
    },
    privacyLink: {
        color: '#475569',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 18,
    },
    backBtn: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    loginTitle: {
        fontSize: 28,
        fontFamily: Theme.fonts.headingSemi,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    loginSubtitle: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 30,
    },
    inputArea: {
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 10,
        color: '#6366F1',
        fontFamily: Theme.fonts.label,
        letterSpacing: 1.5,
        marginLeft: 4,
        fontWeight: 'bold',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        borderRadius: 18,
        paddingHorizontal: 18,
        height: 60,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    inputIcon: {
        marginRight: 14,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: Theme.fonts.body,
    },
    eyeBtn: {
        marginLeft: 10,
    },
    forgotLink: {
        alignSelf: 'flex-end',
        marginRight: 4,
        marginTop: -8,
        marginBottom: 8,
    },
    forgotLinkText: {
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: 'bold',
    },
    button: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    gradientBtn: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontFamily: Theme.fonts.headingSemi,
    },
    dividerArea: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 12,
        opacity: 0.6,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    dividerText: {
        color: '#94A3B8',
        fontSize: 12,
        paddingHorizontal: 16,
        fontWeight: 'bold',
    },
    encryptedNotice: {
        textAlign: 'center',
        color: '#475569',
        fontSize: 12,
        marginTop: 6,
    },

    // Premium Google OAuth Sheet Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    googleSheet: {
        width: '100%',
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    sheetHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    sheetTitle: {
        fontSize: 22,
        fontFamily: Theme.fonts.headingSemi,
        color: '#FFF',
        marginTop: 12,
    },
    sheetSubtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 6,
    },
    realGoogleBtnWrapper: {
        alignItems: 'center',
        marginVertical: 16,
        gap: 8,
    },
    realGoogleBtn: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    realGoogleNotice: {
        fontSize: 11,
        color: '#475569',
        textAlign: 'center',
    },
    sheetAccounts: {
        maxHeight: 200,
        marginBottom: 20,
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    avatarIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4F46E5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarLetter: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    accountName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    accountEmail: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    sheetCloseBtn: {
        height: 60,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sheetCloseText: {
        color: '#94A3B8',
        fontSize: 16,
        fontWeight: 'bold',
    },
    customEmailBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        height: 64,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    customEmailInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 15,
    },
    customEmailBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#4F46E5',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Complete Profile Card Styles
    setupCard: {
        width: width * 0.9,
        backgroundColor: '#0F172A',
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        alignSelf: 'center',
        marginVertical: 40,
    },
    setupHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    setupTitle: {
        fontSize: 22,
        fontFamily: Theme.fonts.headingSemi,
        color: '#FFF',
        marginTop: 10,
    },
    setupSubtitle: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
    },
    setupForm: {
        gap: 16,
    },
    setupSubmitBtn: {
        marginTop: 10,
        borderRadius: 20,
        overflow: 'hidden',
    },
    pillContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    pillContainerScroll: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pillBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    smallPill: {
        width: (width * 0.9 - 72) / 4,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pillBtnActive: {
        backgroundColor: '#4F46E5',
        borderColor: '#6366F1',
    },
    pillText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: 'bold',
    },
    pillTextActive: {
        color: '#FFF',
    },
    modalCloseIcon: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});

