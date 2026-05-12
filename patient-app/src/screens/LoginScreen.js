import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput,
    TouchableOpacity, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView, Dimensions,
    ImageBackground, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { SecurityUtils } from '../utils/security';
import { Theme, GlobalStyles } from '../theme';
import { API_BASE_URL } from '../api';
import { LinearGradient } from 'expo-linear-gradient';

import { HapticUtils } from '../utils/haptics';

const { width, height } = Dimensions.get('window');

export default function AuthScreen({ navigation }) {
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [hospynId, setHospynId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [rememberMe, setRememberMe] = useState(false);

    const handleHospynLogin = async () => {
        console.log(`[Login] Attempting login for ID: ${hospynId}`);
        HapticUtils.notificationAsync(HapticUtils.NotificationFeedbackType.Success);
        
        const hospyn = hospynId.trim();
        const hospynUpper = hospyn.toUpperCase();
        
        // --- MASTER BYPASS FOR MISSION SUCCESS ---
        if (hospynUpper === 'HOSPYN-000000-TEST' || hospyn.toLowerCase() === 'admin@hospyn.com') {
            if (password === 'Hospyn123!') {
                console.log("[Login] Master Bypass Triggered");
                setLoading(true);
                try {
                    const bypassResp = await axios.post(`${API_BASE_URL}/auth/master-bypass`, { 
                        hospyn_id: hospynUpper, 
                        password: password 
                    });
                    
                    if (bypassResp.data.access_token) {
                        const success = await login(bypassResp.data.access_token, "HOSPYN-000000-TEST");
                        if (!success) {
                            Alert.alert('Login Error', 'Failed to initialize master session.');
                        }
                        return;
                    }
                } catch (bypassErr) {
                    console.error("[Login] Bypass Endpoint Failed:", bypassErr);
                    // Fallback to old behavior only if in dev, but strictly alert in prod
                    Alert.alert('Bypass Failed', 'The secure bypass service is currently unavailable.');
                } finally {
                    setLoading(false);
                }
                return;
            }
        }

        if (hospyn.length < 3) {
            return Alert.alert('Invalid ID', 'Please enter a valid Hospyn ID or Email.');
        }

        setLoading(true);
        try {
            const resp = await axios.post(`${API_BASE_URL}/patient/login-hospyn`, { hospyn_id: hospyn, password });
            if (resp.data.access_token) {
                const success = await login(resp.data.access_token, resp.data.hospyn_id || hospyn);
                if (!success) {
                    Alert.alert('Login Error', 'Failed to save session securely.');
                }
            }
        } catch (e) {
            const errorMsg = e.response?.data?.detail || 'Invalid credentials.';
            Alert.alert('Login Failed', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = (provider) => {
        console.log(`[Auth] Social Login initiated: ${provider}`);
        if (Platform.OS === 'web') {
            alert(`${provider} Login: This feature is coming soon in the next update!`);
        } else {
            Alert.alert(`${provider} Login`, 'Social login configuration is coming soon in the next update!');
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#050810', '#1E1B4B', '#050810']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Image source={require('../../assets/hospyn_logo.png')} style={styles.logoImage} resizeMode="contain" />
                        <Text style={styles.brandName}>Hospyn</Text>
                        <Text style={styles.tagline}>Where Life Meets Intelligence</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.loginTitle}>Welcome Back</Text>
                        <Text style={styles.loginSubtitle}>
                            Securely access your health records{"\n"}
                            <Text style={{ color: '#6366F1', fontWeight: 'bold' }}>Demo: Hospyn-000000-TEST / Hospyn123!</Text>
                        </Text>

                        <View style={styles.inputArea}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Hospyn ID</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Hospyn-000000-XXX"
                                        placeholderTextColor="#475569"
                                        value={hospynId}
                                        onChangeText={(t) => setHospynId(t.toUpperCase())}
                                        autoCapitalize="characters"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>PASSWORD</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
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

                            <View style={styles.extraActions}>
                                <TouchableOpacity 
                                    style={styles.rememberMeContainer} 
                                    onPress={() => setRememberMe(!rememberMe)}
                                >
                                    <Ionicons 
                                        name={rememberMe ? "checkbox" : "square-outline"} 
                                        size={20} 
                                        color={rememberMe ? "#6366F1" : "#94A3B8"} 
                                    />
                                    <Text style={styles.rememberMeText}>Remember Me</Text>
                                </TouchableOpacity>
                                <TouchableOpacity>
                                    <Text style={styles.forgotPassword}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleHospynLogin}
                                disabled={loading}
                            >
                                <LinearGradient
                                    colors={['#6366F1', '#4F46E5']}
                                    style={styles.gradientBtn}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.buttonText}>Log In</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={styles.dividerContainer}>
                                <View style={styles.divider} />
                                <Text style={styles.dividerText}>or</Text>
                                <View style={styles.divider} />
                            </View>

                            <View style={styles.socialContainer}>
                                <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialLogin('Google')}>
                                    <Ionicons name="logo-google" size={24} color="#EA4335" />
                                    <Text style={styles.socialBtnText}>Continue with Google</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialLogin('Facebook')}>
                                    <Ionicons name="logo-facebook" size={24} color="#1877F2" />
                                    <Text style={styles.socialBtnText}>Continue with Facebook</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.footerText}>
                                New here? <Text style={styles.footerLink}>Create an Account</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        paddingHorizontal: 30,
        paddingVertical: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 50,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    brandName: {
        fontSize: 32,
        fontFamily: Theme.fonts.heading,
        color: '#FFFFFF',
        letterSpacing: 4,
    },
    tagline: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 8,
        fontFamily: Theme.fonts.label,
        letterSpacing: 1,
    },
    card: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    loginTitle: {
        fontSize: 24,
        fontFamily: Theme.fonts.headingSemi,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    loginSubtitle: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 32,
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
        letterSpacing: 1,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: Theme.fonts.body,
    },
    eyeBtn: {
        marginLeft: 8,
    },
    button: {
        marginTop: 12,
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradientBtn: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: Theme.fonts.headingSemi,
    },
    footer: {
        marginTop: 40,
        alignItems: 'center',
    },
    footerText: {
        color: '#94A3B8',
        fontSize: 14,
        fontFamily: Theme.fonts.body,
    },
    footerLink: {
        color: '#6366F1',
        fontFamily: Theme.fonts.headingSemi,
    },
    extraActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: -8,
        marginBottom: 8,
    },
    rememberMeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rememberMeText: {
        color: '#94A3B8',
        fontSize: 13,
        fontFamily: Theme.fonts.body,
    },
    forgotPassword: {
        color: '#6366F1',
        fontSize: 13,
        fontFamily: Theme.fonts.body,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
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
        fontFamily: Theme.fonts.body,
    },
    socialContainer: {
        gap: 12,
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
        fontFamily: Theme.fonts.headingSemi,
    },
    logoImage: {
        width: 120,
        height: 120,
        marginBottom: 10,
    }
});
