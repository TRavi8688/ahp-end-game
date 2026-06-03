import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Theme, GlobalStyles } from '../theme/Theme';
import ApiService from '../utils/ApiService';

export default function LoginScreen({ onLogin }) {
    const [email, setEmail] = useState('pharmacy1@hospyn.com');
    const [password, setPassword] = useState('Password@123');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) return Alert.alert('Error', 'Please fill all fields');
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);
            
            const res = await ApiService.post('/auth/login', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            ApiService.setToken(res.data.access_token);
            // Optionally fetch me and get hospital_id, but the backend automatically resolves it via deps.get_hospital_id.
            onLogin();
        } catch (error) {
            console.error('Login Error:', error);
            Alert.alert('Login Failed', 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[GlobalStyles.screen, styles.container]}>
            <View style={styles.card}>
                <Text style={styles.brand}>HOSPYN.</Text>
                <Text style={styles.subtitle}>EXTERNAL PHARMACY PARTNER</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={Theme.colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={Theme.colors.textMuted}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />

                <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>SECURE LOGIN</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { justifyContent: 'center', padding: 20 },
    card: { backgroundColor: Theme.colors.surface, padding: 30, borderRadius: 24, borderWidth: 1, borderColor: Theme.colors.border },
    brand: { fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: 2 },
    subtitle: { fontSize: 10, color: Theme.colors.primary, textAlign: 'center', letterSpacing: 3, marginBottom: 40, marginTop: 5, fontWeight: 'bold' },
    input: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    btn: { backgroundColor: Theme.colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    btnText: { color: '#fff', fontWeight: '900', letterSpacing: 2 }
});
