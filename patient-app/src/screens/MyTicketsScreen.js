// patient-app/src/screens/MyTicketsScreen.js
// NEW (2026-06-23): companion to RaiseTicketScreen — lets a patient see the
// status of tickets they've raised, since the old "support" flow had no
// way to check on anything afterward.

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, GlobalStyles } from '../theme';
import ticketService from '../services/ticketService';

const STATUS_COLORS = {
    open: '#F59E0B',
    in_progress: '#6366F1',
    waiting_on_user: '#F59E0B',
    resolved: '#10B981',
    closed: '#64748B',
};

const STATUS_LABELS = {
    open: 'Open',
    in_progress: 'In progress',
    waiting_on_user: 'Waiting on you',
    resolved: 'Resolved',
    closed: 'Closed',
};

export default function MyTicketsScreen({ navigation }) {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const fetchTickets = useCallback(async () => {
        try {
            const res = await ticketService.getMyTickets();
            setTickets(res.tickets || []);
            setError('');
        } catch (e) {
            setError(e.response?.data?.detail || 'Could not load your tickets right now.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    const onRefresh = () => { setRefreshing(true); fetchTickets(); };

    const renderItem = ({ item }) => (
        <View style={[styles.card, { backgroundColor: Theme.colors.card, borderColor: Theme.colors.border }]}>
            <View style={styles.cardTopRow}>
                <Text style={[styles.ticketId, { color: Theme.colors.textMuted }]}>{item.ticket_id}</Text>
                <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[item.status] || '#64748B'}22` }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || '#64748B' }]}>
                        {STATUS_LABELS[item.status] || item.status}
                    </Text>
                </View>
            </View>
            <Text style={[styles.subject, { color: Theme.colors.text }]}>{item.subject}</Text>
            {!!item.last_message && (
                <Text style={[styles.lastMsg, { color: Theme.colors.textMuted }]} numberOfLines={2}>
                    {item.last_message_sender === 'agent' ? 'Support: ' : 'You: '}{item.last_message}
                </Text>
            )}
        </View>
    );

    return (
        <View style={GlobalStyles.screen}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: Theme.colors.text }]}>My tickets</Text>
                <TouchableOpacity onPress={() => navigation.navigate('RaiseTicket')} style={styles.backBtn}>
                    <Ionicons name="add-circle-outline" size={26} color={Theme.colors.primary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={Theme.colors.primary} /></View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={[styles.errorText, { color: Theme.colors.textMuted }]}>{error}</Text>
                    <TouchableOpacity onPress={fetchTickets} style={[styles.retryBtn, { borderColor: Theme.colors.primary }]}>
                        <Text style={{ color: Theme.colors.primary, fontFamily: Theme.fonts.headingSemi }}>Try again</Text>
                    </TouchableOpacity>
                </View>
            ) : tickets.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="chatbubbles-outline" size={56} color={Theme.colors.textMuted} />
                    <Text style={[styles.emptyText, { color: Theme.colors.textMuted }]}>No tickets yet.</Text>
                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: Theme.colors.primary }]}
                        onPress={() => navigation.navigate('RaiseTicket')}
                    >
                        <Text style={styles.primaryBtnText}>Raise a ticket</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={tickets}
                    keyExtractor={(item) => item.ticket_id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 16 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontFamily: Theme.fonts.headingSemi },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    ticketId: { fontSize: 12, fontFamily: Theme.fonts.label, letterSpacing: 1 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 11, fontFamily: Theme.fonts.headingSemi },
    subject: { fontSize: 15, fontFamily: Theme.fonts.headingSemi, marginBottom: 4 },
    lastMsg: { fontSize: 13, fontFamily: Theme.fonts.body, lineHeight: 18 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    errorText: { fontSize: 14, textAlign: 'center', marginBottom: 16, fontFamily: Theme.fonts.body },
    retryBtn: { borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
    emptyText: { fontSize: 15, fontFamily: Theme.fonts.body, marginTop: 12, marginBottom: 20 },
    primaryBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
    primaryBtnText: { color: '#FFF', fontSize: 15, fontFamily: Theme.fonts.headingSemi },
});
