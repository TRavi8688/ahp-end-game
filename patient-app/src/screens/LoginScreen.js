import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput,
    TouchableOpacity, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView, Dimensions,
    ImageBackground, Image, Animated, Easing
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
    const [mode, setMode] = useState('landing'); // 'landing', 'login'

    const handleHospynLogin = async () => {
        if (!hospynId || !password) return Alert.alert('Missing Info', 'Please enter your Hospyn ID and Password.');
        setLoading(true);
        try {
            const identifier = hospynId.trim();
            
            // PRODUCTION AUTHENTICATION
            // We use the standard OAuth2 flow which now supports Hospyn ID, Email, or Phone
            const formData = new FormData();
            formData.append('username', identifier);
            formData.append('password', password);

            const resp = await axios.post(`${API_BASE_URL}/auth/login`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (resp.data.access_token) {
                await login(resp.data.access_token, identifier);
            }
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.response?.data?.detail || 'Invalid credentials.';
            Alert.alert('Login Failed', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    if (mode === 'landing') {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#050810', '#1E1B4B', '#050810']} style={StyleSheet.absoluteFill} />
                <View style={styles.landingContent}>
                    <View style={styles.landingHeader}>
                        <Image source={require('../../assets/logo.png')} style={styles.heroLogo} resizeMode="contain" />
                    </View>

                    <View style={styles.landingActions}>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('login')}>
                            <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn} start={{x:0, y:0}} end={{x:1, y:0}}>
                                <Text style={styles.primaryBtnText}>Login to Passport</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Onboarding')}>
                            <Text style={styles.secondaryBtnText}>Create AI Account</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.trustFooter}>
                        <View style={styles.trustItem}>
                            <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                            <Text style={styles.trustText}>Military-Grade Encryption</Text>
                        </View>
                        <Text style={styles.privacyLink}>By continuing, you agree to our Privacy Policy</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#050810', '#1E1B4B', '#050810']} style={StyleSheet.absoluteFill} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => setMode('landing')}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.card}>
                        <Text style={styles.loginTitle}>Welcome Back</Text>
                        <Text style={styles.loginSubtitle}>Access your encrypted clinical records.</Text>

                        <View style={styles.inputArea}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>HOSPYN ID</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="HOSPYN-000000-XXX"
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

                            <TouchableOpacity style={styles.button} onPress={handleHospynLogin} disabled={loading}>
                                <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Authorize Access</Text>}
                                </LinearGradient>
                            </TouchableOpacity>

                            <Text style={styles.encryptedNotice}>
                                <Ionicons name="lock-closed" size={12} color="#94A3B8" /> End-to-end encrypted session
                            </Text>
                        </View>
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
    landingContent: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 40,
        paddingTop: 100,
        paddingBottom: 60,
    },
    landingHeader: {
        alignItems: 'center',
        marginBottom: 60,
    },
    heroLogo: {
        width: 180,
        height: 180,
    },
    landingActions: {
        gap: 20,
    },
    primaryBtn: {
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: Theme.fonts.headingSemi,
    },
    secondaryBtn: {
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
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
        top: 60,
        left: 30,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 32,
        padding: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
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
        marginBottom: 40,
    },
    inputArea: {
        gap: 24,
    },
    inputGroup: {
        gap: 10,
    },
    label: {
        fontSize: 11,
        color: '#6366F1',
        fontFamily: Theme.fonts.label,
        letterSpacing: 2,
        marginLeft: 4,
        fontWeight: 'bold',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
        fontSize: 16,
        fontFamily: Theme.fonts.body,
    },
    eyeBtn: {
        marginLeft: 10,
    },
    button: {
        marginTop: 10,
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
        fontSize: 18,
        fontFamily: Theme.fonts.headingSemi,
    },
    encryptedNotice: {
        textAlign: 'center',
        color: '#475569',
        fontSize: 12,
        marginTop: 10,
    }
});
