import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../utils/ApiService';
import { HapticUtils } from '../utils/haptics';

export default function SharedAccessScreen({ navigation }) {
    const [activeSharing, setActiveSharing] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const [active, pending] = await Promise.all([
                ApiService.getProfile().then(p => p.active_sharing || []), // Fallback if endpoint differs
                ApiService.getPendingAccess()
            ]);
            
            // If active_sharing is not in profile, we might need a specific endpoint
            // But for now let's assume getPendingAccess is the priority for "Sync"
            setPendingRequests(pending);
            
            // Fetch active from SharingSettings logic if needed
            try {
               const activeRes = await ApiService.client.get('/patient/active-sharing');
               setActiveSharing(activeRes.data);
            } catch(e) {
                console.log("Active sharing fetch fail, using empty");
            }

        } catch (error) {
            console.error('Fetch access error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleApprove = async (id, name) => {
        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Medium);
        try {
            await ApiService.approveAccess(id);
            Alert.alert("Access Granted", `Dr. ${name} can now view your clinical records.`);
            fetchData();
        } catch (e) {
            Alert.alert("Error", "Failed to approve access.");
        }
    };

    const handleRevoke = async (id, name) => {
        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Light);
        Alert.alert(
            "Revoke Access?",
            `Stop sharing data with Dr. ${name}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Revoke", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            await ApiService.revokeAccess(id);
                            fetchData();
                        } catch(e) { Alert.alert("Error", "Failed to revoke."); }
                    }
                }
            ]
        );
    };

    const renderPendingItem = ({ item }) => (
        <View style={styles.pendingCard}>
            <View style={styles.cardHeader}>
                <View style={styles.doctorBadge}>
                    <Ionicons name="medical" size={16} color="#fff" />
                    <Text style={styles.badgeText}>CONNECTION REQUEST</Text>
                </View>
                <Text style={styles.timeLabel}>Just now</Text>
            </View>
            <View style={styles.doctorInfo}>
                <View style={styles.avatarLarge}>
                    <Text style={styles.avatarTextLarge}>{item.doctor_name?.[0] || 'D'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.doctorNameLarge}>{item.doctor_name}</Text>
                    <Text style={styles.clinicName}>{item.clinic_name || 'Hospyn Network'}</Text>
                    <Text style={styles.accessLevel}>Requesting: {item.access_level?.toUpperCase()} ACCESS</Text>
                </View>
            </View>
            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id, item.doctor_name)}>
                    <Text style={styles.approveText}>Approve Access</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRevoke(item.id, item.doctor_name)}>
                    <Text style={styles.rejectText}>Decline</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderActiveItem = ({ item }) => (
        <View style={styles.activeCard}>
            <View style={styles.avatarSmall}>
                <Text style={styles.avatarTextSmall}>{item.doctor_name?.[0] || 'D'}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.doctorNameSmall}>{item.doctor_name}</Text>
                <Text style={styles.activeSub}>{item.clinic_name || 'Hospyn Network'}</Text>
            </View>
            <TouchableOpacity style={styles.revokeIcon} onPress={() => handleRevoke(item.id, item.doctor_name)}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#4c1d95', '#7c3aed']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Hospyn Sync & Consent</Text>
            </LinearGradient>

            {loading ? (
                <ActivityIndicator size="large" color="#4c1d95" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    data={activeSharing}
                    keyExtractor={item => item.id.toString()}
                    ListHeaderComponent={
                        <View style={{ padding: 20 }}>
                            {pendingRequests.length > 0 && (
                                <View style={{ marginBottom: 30 }}>
                                    <Text style={styles.sectionTitle}>Pending Approvals ({pendingRequests.length})</Text>
                                    {pendingRequests.map(item => renderPendingItem({ item }))}
                                </View>
                            )}
                            <Text style={styles.sectionTitle}>Doctors with Active Access</Text>
                            {activeSharing.length === 0 && (
                                <View style={styles.emptyBox}>
                                    <Ionicons name="people-outline" size={48} color="#e5e7eb" />
                                    <Text style={styles.emptyText}>No active connections. Share your QR with a doctor to begin syncing.</Text>
                                </View>
                            )}
                        </View>
                    }
                    renderItem={renderActiveItem}
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            )}

            <View style={styles.footerInfo}>
                <Ionicons name="lock-closed" size={14} color="#9ca3af" />
                <Text style={styles.footerText}>All access is logged and encrypted. You can revoke any connection instantly.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f7ff' },
    header: { padding: 20, paddingTop: 60, paddingBottom: 30, flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    sectionTitle: { fontSize: 14, fontWeight: '900', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
    pendingCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 15, elevation: 4, shadowColor: '#7c3aed', shadowOpacity: 0.1, shadowRadius: 10 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    doctorBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', paddingHorizontal: 10, py: 4, borderRadius: 8, gap: 5 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    timeLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
    doctorInfo: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
    avatarLarge: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e9d5ff' },
    avatarTextLarge: { fontSize: 24, fontWeight: 'bold', color: '#4c1d95' },
    doctorNameLarge: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
    clinicName: { fontSize: 14, color: '#6b7280', marginTop: 2 },
    accessLevel: { fontSize: 11, fontWeight: '900', color: '#0d9488', marginTop: 6 },
    actionRow: { flexDirection: 'row', gap: 10 },
    approveBtn: { flex: 2, backgroundColor: '#4c1d95', py: 12, borderRadius: 14, alignItems: 'center' },
    approveText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    rejectBtn: { flex: 1, backgroundColor: '#f3f4f6', py: 12, borderRadius: 14, alignItems: 'center' },
    rejectText: { color: '#6b7280', fontWeight: 'bold', fontSize: 15 },
    activeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, padding: 15, borderRadius: 18, marginBottom: 10, borderWeight: 1, borderColor: '#f3f4f6' },
    avatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center' },
    avatarTextSmall: { fontSize: 16, fontWeight: 'bold', color: '#4b5563' },
    doctorNameSmall: { fontSize: 15, fontWeight: 'bold', color: '#374151' },
    activeSub: { fontSize: 12, color: '#9ca3af' },
    revokeIcon: { padding: 10 },
    emptyBox: { alignItems: 'center', py: 40 },
    emptyText: { textAlign: 'center', color: '#9ca3af', fontSize: 14, marginTop: 15, px: 30, lineHeight: 20 },
    footerInfo: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
    footerText: { fontSize: 11, color: '#9ca3af', textAlign: 'center' }
});
