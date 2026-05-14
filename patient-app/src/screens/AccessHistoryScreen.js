import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../utils/ApiService';
import { Theme, GlobalStyles } from '../theme';
import { HapticUtils } from '../utils/haptics';

export default function AccessHistoryScreen({ navigation }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchHistory = async () => {
        try {
            const data = await ApiService.getAccessHistory();
            setHistory(data);
        } catch (error) {
            console.error('Fetch history error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const renderItem = ({ item }) => {
        const isGranted = item.status === 'granted';
        const isRevoked = item.status === 'revoked';
        const statusColor = isGranted ? '#10b981' : isRevoked ? '#ef4444' : '#f59e0b';

        return (
            <View style={[styles.historyCard, GlobalStyles.glass]}>
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
                    <View style={[styles.badge, { backgroundColor: statusColor + '15' }]}>
                        <Text style={[styles.badgeText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.footer}>
                    <View style={styles.timeBox}>
                        <Ionicons name="time-outline" size={14} color="#64748B" />
                        <Text style={styles.timeText}>
                            {isGranted ? `Granted: ${new Date(item.granted_at).toLocaleDateString()}` :
                             isRevoked ? `Revoked: ${new Date(item.revoked_at).toLocaleDateString()}` :
                             `Requested: ${new Date(item.created_at).toLocaleDateString()}`}
                        </Text>
                    </View>
                    {item.last_accessed_at && (
                        <View style={styles.timeBox}>
                            <Ionicons name="eye-outline" size={14} color="#64748B" />
                            <Text style={styles.timeText}>Last Viewed: {new Date(item.last_accessed_at).toLocaleDateString()}</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={GlobalStyles.screen}>
            <LinearGradient colors={['#0F172A', '#050810']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={[GlobalStyles.heading, styles.headerTitle]}>ACCESS LOGS</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                </TouchableOpacity>
            </LinearGradient>

            {loading ? (
                <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Ionicons name="shield-outline" size={80} color="#1E293B" />
                            <Text style={styles.emptyTitle}>NO ACTIVITY YET</Text>
                            <Text style={styles.emptySub}>All doctor interactions with your clinical profile will be securely logged here.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 20, letterSpacing: 4 },
    backBtn: { padding: 4 },
    listContent: { padding: 20 },
    historyCard: { padding: 20, borderRadius: 24, marginBottom: 15 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    doctorInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    doctorName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    clinicName: { color: '#64748B', fontSize: 12, marginTop: 2 },
    badge: { px: 10, py: 4, borderRadius: 8 },
    badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 15 },
    footer: { gap: 8 },
    timeBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeText: { color: '#64748B', fontSize: 11 },
    emptyBox: { alignItems: 'center', py: 100, px: 40 },
    emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 2, marginTop: 20 },
    emptySub: { color: '#475569', textAlign: 'center', fontSize: 13, marginTop: 10, lineHeight: 20 }
});
