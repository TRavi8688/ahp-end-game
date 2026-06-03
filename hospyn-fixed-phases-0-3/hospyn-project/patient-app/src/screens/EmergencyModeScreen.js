import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { SecurityUtils } from '../utils/security';
import { API_BASE_URL } from '../api';

export default function EmergencyModeScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEmergencyProfile = async () => {
            try {
                const token = await SecurityUtils.getToken();
                if (token) {
                    const response = await axios.get(`${API_BASE_URL}/patient/profile`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setProfile(response.data);
                }
            } catch (err) {
                console.error("Emergency profile fetch error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchEmergencyProfile();
    }, []);

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#991b1b', '#450a0a']} style={styles.content}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>EMERGENCY MODE</Text>
                    <View style={{ width: 30 }} />
                </View>

                <View style={styles.sosContainer}>
                    <TouchableOpacity style={styles.sosButton}>
                        <Text style={styles.sosText}>SOS</Text>
                        <Text style={styles.sosSubtext}>Tap to Call Emergency</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.actionsBox}>
                    <Text style={styles.boxTitle}>Quick Actions</Text>

                    <TouchableOpacity style={styles.actionItem}>
                        <Ionicons name="people" size={24} color="#ef4444" />
                        <Text style={styles.actionText}>Call Kin / Family</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionItem}>
                        <Ionicons name="medical" size={24} color="#ef4444" />
                        <Text style={styles.actionText}>Nearby Hospitals</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionItem}>
                        <Ionicons name="medkit" size={24} color="#ef4444" />
                        <Text style={styles.actionText}>First Aid Tips</Text>
                    </TouchableOpacity>

                    <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>MY EMERGENCY PROFILE</Text>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Blood Group:</Text>
                            <Text style={styles.infoValue}>{profile?.blood_group || 'Not Set'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Allergies:</Text>
                            <Text style={styles.infoValue}>{profile?.allergies || 'None Known'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Conditions:</Text>
                            <Text style={styles.infoValue}>{profile?.medical_conditions || 'None Declared'}</Text>
                        </View>
                    </View>
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, padding: 25 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 30
    },
    closeBtn: { padding: 5 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
    sosContainer: { alignItems: 'center', marginBottom: 40 },
    sosButton: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 20,
        shadowColor: '#ef4444',
        shadowOpacity: 0.8,
        shadowRadius: 20
    },
    sosText: { fontSize: 50, fontWeight: '900', color: '#b91c1c' },
    sosSubtext: { fontSize: 12, color: '#991b1b', fontWeight: 'bold' },
    actionsBox: { flex: 1 },
    boxTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15, opacity: 0.8 },
    actionItem: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: 20,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15
    },
    actionText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 15 },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 25,
        padding: 20,
        marginTop: 10,
        marginBottom: 40
    },
    infoTitle: { fontSize: 12, fontWeight: '900', color: '#b91c1c', marginBottom: 15, letterSpacing: 1 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    infoLabel: { color: '#6b7280', fontSize: 13 },
    infoValue: { color: '#111827', fontSize: 14, fontWeight: 'bold' },
});
