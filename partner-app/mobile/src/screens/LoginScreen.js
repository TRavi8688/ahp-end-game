// ============================================================
// LoginScreen.js — OTP Auth wired to backend
// Place at: pharma-mobile-app/src/screens/LoginScreen.js
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, ScrollView,
} from 'react-native';
import { sendOTP, verifyOTP } from '../services/pharmaApi';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    const trimmed = phone.trim();
    if (!/^\+91[6-9]\d{9}$/.test(trimmed)) {
      Alert.alert('Invalid Number', 'Enter a valid Indian mobile number (+91XXXXXXXXXX)');
      return;
    }
    setLoading(true);
    try {
      await sendOTP(trimmed);
      setStep('otp');
      startCountdown();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Enter the 6-digit OTP sent to your phone.');
      return;
    }
    setLoading(true);
    try {
      await verifyOTP(phone.trim(), otp.trim());
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err) {
      Alert.alert('Login Failed', err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>💊</Text>
          <Text style={styles.title}>Hospyn Pharma</Text>
          <Text style={styles.subtitle}>Pharmacy Management Portal</Text>
        </View>

        {step === 'phone' ? (
          <View style={styles.form}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              maxLength={13}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendOTP}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send OTP</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Enter OTP</Text>
            <Text style={styles.sentTo}>OTP sent to {phone}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={otp}
              onChangeText={setOtp}
              placeholder="• • • • • •"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleVerifyOTP}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Verify & Login</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendBtn}
              onPress={handleSendOTP}
              disabled={countdown > 0 || loading}
            >
              <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }}>
              <Text style={styles.changeNumber}>← Change Number</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56 },
  title: { fontSize: 28, fontWeight: '700', color: '#0369a1', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  sentTo: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  input: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, color: '#1e293b', marginBottom: 20 },
  otpInput: { fontSize: 24, letterSpacing: 12, textAlign: 'center' },
  btn: { backgroundColor: '#0ea5e9', borderRadius: 10, padding: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn: { marginTop: 16, alignItems: 'center' },
  resendText: { color: '#0ea5e9', fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: '#94a3b8' },
  changeNumber: { textAlign: 'center', marginTop: 12, color: '#64748b', fontSize: 14 },
});
