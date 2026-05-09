import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../api';

export default function SharingSettings({ navigation }) {
    const [activeSharing, setActiveSharing] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchActiveSharing = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/patient/active-sharing`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveSharing(response.data);
        } catch (error) {
            console.error('Fetch sharing error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveSharing();
    }, []);

    const handleRevoke = async (accessId, doctorName) => {
        Alert.alert(
            "Revoke Access?",
            `Are you sure you want to stop sharing your records with Dr. ${doctorName}? They will no longer be able to view your profile.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Revoke",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            await axios.post(`${API_BASE_URL}/patient/revoke-access/${accessId}`, {}, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            Alert.alert("Revoked", "Access has been revoked immediately.");
                            fetchActiveSharing();
                        } catch (error) {
                            Alert.alert("Error", "Failed to revoke access.");
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={28} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Active Sharing</Text>
                <View style={{ width: 28 }} />
            </View>

            <View style={styles.infoBox}>
                <Ionicons name="shield-checkmark" size={20} color="#059669" />
                <Text style={styles.infoText}>You are in full control. Doctors listed below can access your health records in real-time. Revoke at any time.</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#4c1d95" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={activeSharing}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item }) => (
                        <View style={styles.doctorCard}>
                            <View style={styles.doctorInfo}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{item.doctor_name?.[0] || 'D'}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.doctorName}>Dr. {item.doctor_name}</Text>
                                    <Text style={styles.clinicName}>{item.clinic_name || 'Hospyn Network'}</Text>
                                    <View style={styles.statusRow}>
                                        <Text style={styles.timeLabel}>Granted: {new Date(item.granted_at).toLocaleDateString()}</Text>
                                        <View style={styles.activeDot} />
                                        <Text style={styles.activeText}>Active Now</Text>
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(item.id, item.doctor_name)}>
                                <Text style={styles.revokeBtnText}>Revoke Access</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={60} color="#e5e7eb" />
                            <Text style={styles.emptyText}>No doctors currently have access to your records.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    infoBox: { flexDirection: 'row', backgroundColor: '#ecfdf5', margin: 20, padding: 15, borderRadius: 12, alignItems: 'center', gap: 10 },
    infoText: { flex: 1, fontSize: 13, color: '#065f46', lineHeight: 18 },
    doctorCard: {
        padding: 20,
        borderRadius: 16,
        backgroundColor: '#fff',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2
    },
    doctorInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 15 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 20, fontWeight: 'bold', color: '#4b5563' },
    doctorName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    clinicName: { fontSize: 13, color: '#6b7280', marginTop: 2 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
    timeLabel: { fontSize: 11, color: '#9ca3af' },
    activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
    activeText: { fontSize: 11, color: '#10b981', fontWeight: 'bold' },
    revokeBtn: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#fee2e2',
        justifyContent: 'center',
        alignItems: 'center'
    },
    revokeBtnText: { color: '#dc2626', fontWeight: 'bold', fontSize: 14 },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 20, fontSize: 14, px: 40 }
});
