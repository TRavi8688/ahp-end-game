import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../api';

export default function NotificationsScreen({ navigation }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/patient/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(response.data);
        } catch (error) {
            console.error('Fetch notifs error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleAction = async (notifId, accessId, action) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const endpoint = action === 'approve'
                ? `${API_BASE_URL}/patient/approve-access/${accessId}`
                : `${API_BASE_URL}/patient/revoke-access/${accessId}`;

            await axios.post(endpoint, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Alert.alert("Success", `Access ${action === 'approve' ? 'granted' : 'rejected'} successfully.`);
            fetchNotifications(); // Refresh
        } catch (error) {
            console.error('Action error:', error);
            Alert.alert("Error", "Failed to process your request.");
        }
    };

    const renderNotification = ({ item }) => {
        const isConsent = item.type === 'consent_request';
        const icon = isConsent ? 'people' : item.type === 'record_added' ? 'document-text' : 'notifications';
        const color = isConsent ? '#3b82f6' : '#4c1d95';

        return (
            <View style={styles.alertCard}>
                <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
                    <Ionicons name={icon} size={24} color={color} />
                </View>
                <View style={styles.content}>
                    <View style={styles.topRow}>
                        <Text style={styles.title}>{item.title || "Health Alert"}</Text>
                        <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <Text style={styles.msg}>{item.body}</Text>

                    {isConsent && item.related_entity_id && (
                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.approveBtn]}
                                onPress={() => handleAction(item.id, item.related_entity_id, 'approve')}
                            >
                                <Text style={styles.btnText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.rejectBtn]}
                                onPress={() => handleAction(item.id, item.related_entity_id, 'reject')}
                            >
                                <Text style={[styles.btnText, { color: '#6b7280' }]}>Reject</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={28} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Alerts</Text>
                <TouchableOpacity onPress={fetchNotifications}>
                    <Ionicons name="refresh" size={20} color="#4c1d95" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#4c1d95" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderNotification}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={
                        <Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 50 }}>No new alerts</Text>
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
    alertCard: {
        flexDirection: 'row',
        padding: 15,
        borderRadius: 15,
        backgroundColor: '#fff',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#f3f4f6'
    },
    iconBox: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    content: { flex: 1 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    title: { fontSize: 15, fontWeight: 'bold', color: '#374151' },
    time: { fontSize: 11, color: '#9ca3af' },
    msg: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
    actionRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
    actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    approveBtn: { backgroundColor: '#4c1d95' },
    rejectBtn: { backgroundColor: '#f3f4f6' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
