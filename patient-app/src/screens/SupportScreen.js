import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, Platform, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../utils/ApiService';
import { Theme, GlobalStyles, subscribeToTheme } from '../theme';
import { useAuth } from '../contexts/AuthContext';

const CATEGORIES = [
    { key: 'billing',      label: 'Billing & Payments',   icon: 'card-outline' },
    { key: 'technical',    label: 'App / Technical Issue', icon: 'bug-outline' },
    { key: 'onboarding',   label: 'Registration / Setup',  icon: 'person-add-outline' },
    { key: 'data',         label: 'My Health Records',     icon: 'document-text-outline' },
    { key: 'other',        label: 'General Enquiry',       icon: 'chatbubble-ellipses-outline' },
];

const PRIORITIES = [
    { key: 'low',      label: 'Low',      color: '#10B981' },
    { key: 'medium',   label: 'Medium',   color: '#F59E0B' },
    { key: 'high',     label: 'High',     color: '#EF4444' },
    { key: 'critical', label: 'Critical', color: '#7C3AED' },
];

const SLA_MAP = { critical: 2, high: 4, medium: 8, low: 24 };

export default function SupportScreen({ navigation }) {
    const { user } = useAuth();
    const [theme, setThemeState] = useState(Theme);

    // Form state
    const [category, setCategory]   = useState('');
    const [priority, setPriority]   = useState('medium');
    const [subject, setSubject]     = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting]   = useState(false);
    const [submitted, setSubmitted]     = useState(false);
    const [ticketId, setTicketId]       = useState('');

    // My tickets state
    const [tab, setTab]           = useState('new');   // 'new' | 'mine'
    const [tickets, setTickets]   = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [ticketsError, setTicketsError]     = useState('');

    useEffect(() => {
        const unsub = subscribeToTheme(t => setThemeState(t));
        return () => unsub && unsub();
    }, []);

    useEffect(() => {
        if (tab === 'mine') fetchMyTickets();
    }, [tab]);

    const fetchMyTickets = async () => {
        setLoadingTickets(true);
        setTicketsError('');
        try {
            const data = await ApiService.getMyTickets();
            setTickets(data?.tickets || data || []);
        } catch (e) {
            setTicketsError('Could not load your tickets. Please try again.');
        } finally {
            setLoadingTickets(false);
        }
    };

    const handleSubmit = async () => {
        if (!category) {
            Alert.alert('Select Category', 'Please choose what your issue is about.');
            return;
        }
        if (!subject.trim()) {
            Alert.alert('Missing Subject', 'Please enter a brief subject for your issue.');
            return;
        }
        if (!description.trim() || description.trim().length < 20) {
            Alert.alert('More Detail Needed', 'Please describe your issue in at least 20 characters so our team can help you faster.');
            return;
        }

        setSubmitting(true);
        try {
            const result = await ApiService.createSupportTicket({
                category,
                subject:      subject.trim(),
                description:  description.trim(),
                priority,
                owner_email:  user?.email || undefined,
                owner_phone:  user?.phone_number || undefined,
            });
            setTicketId(result?.ticket_id || result?.id || 'TKT-XXXXX');
            setSubmitted(true);
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to submit ticket. Please try again.';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('Submission Failed', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setCategory('');
        setPriority('medium');
        setSubject('');
        setDescription('');
        setSubmitted(false);
        setTicketId('');
    };

    const s = styles(theme);

    // ── Success screen ─────────────────────────────────────────────────────────
    if (submitted) {
        const sla = SLA_MAP[priority] ?? 24;
        return (
            <LinearGradient colors={theme.colors.gradientBg || ['#0F172A', '#1E1B4B']} style={s.flex}>
                <View style={s.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Support</Text>
                    <View style={{ width: 36 }} />
                </View>
                <View style={[s.flex, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
                    <View style={s.successIcon}>
                        <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                    </View>
                    <Text style={s.successTitle}>Ticket Raised!</Text>
                    <Text style={s.ticketIdText}>{ticketId}</Text>
                    <Text style={s.successMsg}>
                        Our {CATEGORIES.find(c => c.key === category)?.label?.toLowerCase() || 'support'} team will respond within{' '}
                        <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{sla} hour{sla !== 1 ? 's' : ''}</Text>.
                    </Text>
                    <Text style={[s.successMsg, { marginTop: 8, fontSize: 13, color: theme.colors.textMuted }]}>
                        A confirmation has been sent to {user?.email || 'your registered email'}.
                    </Text>
                    <TouchableOpacity style={[s.submitBtn, { marginTop: 32 }]} onPress={resetForm}>
                        <Text style={s.submitBtnText}>RAISE ANOTHER TICKET</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.submitBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary, marginTop: 12 }]}
                        onPress={() => { setTab('mine'); setSubmitted(false); }}
                    >
                        <Text style={[s.submitBtnText, { color: theme.colors.primary }]}>VIEW MY TICKETS</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        );
    }

    // ── Main screen ────────────────────────────────────────────────────────────
    return (
        <LinearGradient colors={theme.colors.gradientBg || ['#0F172A', '#1E1B4B']} style={s.flex}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Hospin Help Center</Text>
                <View style={{ width: 36 }} />
            </View>

            {/* Tab bar */}
            <View style={s.tabBar}>
                <TouchableOpacity style={[s.tab, tab === 'new'  && s.tabActive]} onPress={() => setTab('new')}>
                    <Text style={[s.tabText, tab === 'new'  && s.tabTextActive]}>New Ticket</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, tab === 'mine' && s.tabActive]} onPress={() => setTab('mine')}>
                    <Text style={[s.tabText, tab === 'mine' && s.tabTextActive]}>My Tickets</Text>
                </TouchableOpacity>
            </View>

            {tab === 'new' ? (
                <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
                    {/* Category */}
                    <Text style={s.sectionLabel}>WHAT IS YOUR ISSUE ABOUT?</Text>
                    <View style={s.categoryGrid}>
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat.key}
                                style={[s.categoryCard, category === cat.key && s.categoryCardActive]}
                                onPress={() => setCategory(cat.key)}
                            >
                                <Ionicons name={cat.icon} size={22} color={category === cat.key ? '#fff' : theme.colors.textMuted} />
                                <Text style={[s.categoryLabel, category === cat.key && { color: '#fff' }]}>{cat.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Priority */}
                    <Text style={[s.sectionLabel, { marginTop: 24 }]}>PRIORITY</Text>
                    <View style={s.priorityRow}>
                        {PRIORITIES.map(p => (
                            <TouchableOpacity
                                key={p.key}
                                style={[s.priorityChip, priority === p.key && { backgroundColor: p.color, borderColor: p.color }]}
                                onPress={() => setPriority(p.key)}
                            >
                                <Text style={[s.priorityText, priority === p.key && { color: '#fff' }]}>{p.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={s.slaHint}>
                        Response within <Text style={{ color: theme.colors.primary }}>{SLA_MAP[priority]}h</Text> for {priority} priority.
                    </Text>

                    {/* Subject */}
                    <Text style={[s.sectionLabel, { marginTop: 24 }]}>SUBJECT</Text>
                    <TextInput
                        style={s.input}
                        value={subject}
                        onChangeText={setSubject}
                        placeholder="Brief summary of your issue"
                        placeholderTextColor={theme.colors.textMuted}
                        maxLength={120}
                    />

                    {/* Description */}
                    <Text style={[s.sectionLabel, { marginTop: 16 }]}>DESCRIPTION</Text>
                    <TextInput
                        style={[s.input, s.textarea]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Describe your issue in detail — include any error messages, steps to reproduce, or relevant dates."
                        placeholderTextColor={theme.colors.textMuted}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                        maxLength={2000}
                    />
                    <Text style={s.charCount}>{description.length}/2000</Text>

                    <TouchableOpacity
                        style={[s.submitBtn, (submitting || !category || !subject.trim() || description.trim().length < 20) && s.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={submitting || !category || !subject.trim() || description.trim().length < 20}
                    >
                        {submitting
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.submitBtnText}>SUBMIT TICKET</Text>
                        }
                    </TouchableOpacity>

                    <View style={s.emergencyBanner}>
                        <Ionicons name="call-outline" size={16} color="#EF4444" />
                        <Text style={s.emergencyText}>
                            Medical emergency? Call{' '}
                            <Text style={{ color: '#EF4444', fontWeight: '700' }}>112</Text>
                            {' '}or your hospital directly.
                        </Text>
                    </View>
                </ScrollView>
            ) : (
                // ── My Tickets tab ─────────────────────────────────────────────
                <View style={s.flex}>
                    {loadingTickets ? (
                        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
                    ) : ticketsError ? (
                        <View style={s.emptyState}>
                            <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
                            <Text style={s.emptyText}>{ticketsError}</Text>
                            <TouchableOpacity onPress={fetchMyTickets} style={s.retryBtn}>
                                <Text style={[s.submitBtnText, { color: theme.colors.primary }]}>RETRY</Text>
                            </TouchableOpacity>
                        </View>
                    ) : tickets.length === 0 ? (
                        <View style={s.emptyState}>
                            <Ionicons name="ticket-outline" size={48} color={theme.colors.textMuted} />
                            <Text style={s.emptyText}>No tickets yet.</Text>
                            <Text style={[s.emptyText, { fontSize: 13, marginTop: 4 }]}>Your submitted support tickets will appear here.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={tickets}
                            keyExtractor={item => String(item.ticket_id || item.id)}
                            contentContainerStyle={{ padding: 16 }}
                            renderItem={({ item }) => {
                                const priorColor = PRIORITIES.find(p => p.key === item.priority)?.color || '#94A3B8';
                                const statusColor = item.status === 'resolved' ? '#10B981' : item.status === 'in_progress' ? '#F59E0B' : '#94A3B8';
                                return (
                                    <View style={s.ticketCard}>
                                        <View style={s.ticketCardHeader}>
                                            <Text style={s.ticketId}>{item.ticket_id || item.id}</Text>
                                            <View style={[s.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                                                <Text style={[s.statusText, { color: statusColor }]}>{(item.status || 'open').toUpperCase().replace('_', ' ')}</Text>
                                            </View>
                                        </View>
                                        <Text style={s.ticketSubject}>{item.subject}</Text>
                                        <View style={s.ticketMeta}>
                                            <View style={[s.priorityDot, { backgroundColor: priorColor }]} />
                                            <Text style={s.ticketMetaText}>{item.priority || 'medium'}</Text>
                                            <Text style={[s.ticketMetaText, { marginLeft: 12 }]}>
                                                {item.category || 'other'}
                                            </Text>
                                        </View>
                                        {item.created_at && (
                                            <Text style={s.ticketDate}>
                                                Raised: {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </Text>
                                        )}
                                    </View>
                                );
                            }}
                        />
                    )}
                </View>
            )}
        </LinearGradient>
    );
}

const styles = (theme) => StyleSheet.create({
    flex:               { flex: 1 },
    header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 20, paddingBottom: 12 },
    backBtn:            { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
    headerTitle:        { fontSize: 17, fontWeight: '700', color: theme.colors.text, letterSpacing: 0.5 },
    tabBar:             { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 },
    tab:                { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    tabActive:          { backgroundColor: theme.colors.primary },
    tabText:            { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
    tabTextActive:      { color: '#fff' },
    scroll:             { padding: 16, paddingBottom: 40 },
    sectionLabel:       { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, letterSpacing: 1, marginBottom: 10 },
    categoryGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    categoryCard:       { width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', gap: 6 },
    categoryCardActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    categoryLabel:      { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted, textAlign: 'center' },
    priorityRow:        { flexDirection: 'row', gap: 8 },
    priorityChip:       { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
    priorityText:       { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },
    slaHint:            { fontSize: 12, color: theme.colors.textMuted, marginTop: 8 },
    input:              { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: theme.colors.text, fontSize: 14 },
    textarea:           { minHeight: 120, paddingTop: 12 },
    charCount:          { fontSize: 11, color: theme.colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 24 },
    submitBtn:          { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 8 },
    submitBtnDisabled:  { opacity: 0.45 },
    submitBtnText:      { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
    emergencyBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: 12, marginTop: 16 },
    emergencyText:      { flex: 1, color: theme.colors.textMuted, fontSize: 12 },
    emptyState:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
    emptyText:          { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' },
    retryBtn:           { marginTop: 12, padding: 10 },
    ticketCard:         { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
    ticketCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    ticketId:           { fontSize: 12, fontWeight: '700', color: theme.colors.primary, letterSpacing: 0.5 },
    statusBadge:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
    statusText:         { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    ticketSubject:      { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
    ticketMeta:         { flexDirection: 'row', alignItems: 'center' },
    priorityDot:        { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    ticketMetaText:     { fontSize: 12, color: theme.colors.textMuted, textTransform: 'capitalize' },
    ticketDate:         { fontSize: 11, color: theme.colors.textMuted, marginTop: 8 },
    successIcon:        { marginBottom: 16 },
    successTitle:       { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
    ticketIdText:       { fontSize: 16, fontWeight: '700', color: theme.colors.primary, letterSpacing: 1, marginBottom: 16 },
    successMsg:         { fontSize: 15, color: theme.colors.text, textAlign: 'center', lineHeight: 22 },
});
