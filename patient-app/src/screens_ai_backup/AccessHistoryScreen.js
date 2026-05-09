import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import { API_BASE_URL } from '../api';

export default function AccessHistoryScreen({ navigation }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            // We use the active-sharing endpoint but might need a dedicated history one
            // For now, let's assume we want to see ALL doctor_access records for this patient
            // We'll update the backend to provide a history endpoint if needed, 
            // but for now let's reuse/filter get_patient_active_sharing or similar.
            // Actually, let's assume the backend has a /patient/access-history endpoint now.
            const response = await axios.get(`${API_BASE_URL}/patient/access-history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(response.data);
        } catch (error) {
            console.error('Fetch history error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const renderItem = ({ item }) => {
        const isGranted = item.status === 'granted';
        const isRevoked = item.status === 'revoked';
        const statusColor = isGranted ? '#10b981' : isRevoked ? '#ef4444' : '#f59e0b';
        const statusText = item.status.toUpperCase();

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.doctorInfo}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{item.doctor_name?.[0] || 'D'}</Text>
                        </View>
                        <View>
                            <Text style={styles.doctorName}>Dr. {item.doctor_name}</Text>
                            <Text style={styles.clinicName}>{item.clinic_name || 'Hospyn Network'}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardFooter}>
                    <View style={styles.timeInfo}>
                        <Ionicons name="calendar-outline" size={14} color="#64748b" />
                        <Text style={styles.timeText}>
                            {isGranted ? `Granted: ${new Date(item.granted_at).toLocaleDateString()}` :
                                isRevoked ? `Revoked: ${new Date(item.revoked_at).toLocaleDateString()}` :
                                    `Requested: ${new Date(item.created_at).toLocaleDateString()}`}
                        </Text>
                    </View>
                    {item.last_accessed_at && (
                        <View style={styles.timeInfo}>
                            <Ionicons name="eye-outline" size={14} color="#64748b" />
                            <Text style={styles.timeText}>Last Seen: {new Date(item.last_accessed_at).toLocaleDateString()}</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Access History</Text>
                <TouchableOpacity onPress={fetchHistory}>
                    <Ionicons name="refresh" size={20} color="#4c1d95" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#4c1d95" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="shield-outline" size={80} color="#e2e8f0" />
                            <Text style={styles.emptyTitle}>Secure & Private</Text>
                            <Text style={styles.emptyText}>All doctor access requests and approvals will be logged here for your review.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    listContent: { padding: 20 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    doctorInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarText: { fontSize: 18, fontWeight: 'bold', color: '#475569' },
    doctorName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    clinicName: { fontSize: 12, color: '#64748b', marginTop: 2 },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    statusText: { fontSize: 10, fontWeight: '900' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },
    cardFooter: { gap: 8 },
    timeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: { fontSize: 12, color: '#64748b' },
    emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 24 },
    emptyText: { textAlign: 'center', color: '#64748b', marginTop: 12, lineHeight: 20 },
});
