import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../utils/ApiService';
import { Theme, GlobalStyles } from '../theme';
import { HapticUtils } from '../utils/haptics';

export default function NotificationsScreen({ navigation }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = async () => {
        try {
            const data = await ApiService.getNotifications();
            setNotifications(data);
        } catch (error) {
            console.error('Fetch notifs error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const handleAction = async (notifId, accessId, action) => {
        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Medium);
        try {
            if (action === 'approve') {
                await ApiService.approveAccess(accessId);
            } else {
                await ApiService.revokeAccess(accessId);
            }
            Alert.alert("Success", `Request ${action === 'approve' ? 'granted' : 'declined'}.`);
            fetchNotifications();
        } catch (error) {
            Alert.alert("Error", "Failed to process request.");
        }
    };

    const renderItem = ({ item }) => {
        const isConsent = item.type === 'consent_request';
        const icon = isConsent ? 'people-outline' : 'notifications-outline';
        const color = isConsent ? Theme.colors.primary : Theme.colors.secondary;

        return (
            <View style={[styles.alertCard, GlobalStyles.glass]}>
                <View style={styles.cardTop}>
                    <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
                        <Ionicons name={icon} size={24} color={color} />
                    </View>
                    <View style={styles.content}>
                        <View style={styles.headerRow}>
                            <Text style={styles.title}>{item.title || 'System Alert'}</Text>
                            <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                        <Text style={styles.msg}>{item.body}</Text>
                    </View>
                </View>

                {isConsent && item.related_entity_id && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity 
                            style={styles.approveBtn} 
                            onPress={() => handleAction(item.id, item.related_entity_id, 'approve')}
                        >
                            <Text style={styles.btnText}>APPROVE ACCESS</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={styles.rejectBtn} 
                            onPress={() => handleAction(item.id, item.related_entity_id, 'reject')}
                        >
                            <Text style={styles.rejectText}>DECLINE</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={GlobalStyles.screen}>
            <LinearGradient colors={['#0F172A', '#050810']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={[GlobalStyles.heading, styles.headerTitle]}>ALERTS</Text>
                <View style={{ width: 24 }} />
            </LinearGradient>

            <FlatList
                data={notifications}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.emptyBox}>
                            <Ionicons name="notifications-off-outline" size={60} color="#1E293B" />
                            <Text style={styles.emptyText}>No new notifications.</Text>
                        </View>
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 20, letterSpacing: 4 },
    backBtn: { padding: 4 },
    listContent: { padding: 20 },
    alertCard: { padding: 16, borderRadius: 20, marginBottom: 12 },
    cardTop: { flexDirection: 'row', gap: 15 },
    iconBox: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    title: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    time: { color: '#64748B', fontSize: 11 },
    msg: { color: '#94A3B8', fontSize: 13, lineHeight: 18 },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 15 },
    approveBtn: { flex: 2, backgroundColor: Theme.colors.primary, py: 10, borderRadius: 12, alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    rejectBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', py: 10, borderRadius: 12, alignItems: 'center' },
    rejectText: { color: '#64748B', fontSize: 12, fontWeight: 'bold' },
    emptyBox: { alignItems: 'center', py: 100 },
    emptyText: { color: '#475569', marginTop: 20, fontSize: 14 }
});
