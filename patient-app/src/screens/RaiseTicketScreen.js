// patient-app/src/screens/RaiseTicketScreen.js
//
// NEW (2026-06-23): replaces the fake "Hospyn Help Center" alert that used
// to just show a local message and never contacted anyone. This screen
// actually calls the backend's existing ticket system.

import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, GlobalStyles } from '../theme';
import { HapticUtils } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import ticketService from '../services/ticketService';

const CATEGORIES = [
    { key: 'technical', label: 'App / Technical issue' },
    { key: 'billing', label: 'Billing question' },
    { key: 'onboarding', label: 'Account / Sign-in help' },
    { key: 'data', label: 'My records / data' },
    { key: 'other', label: 'Something else' },
];

const PRIORITIES = [
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Medium' },
    { key: 'high', label: 'High' },
    { key: 'critical', label: 'Urgent' },
];

export default function RaiseTicketScreen({ navigation }) {
    const { user } = useAuth();
    const [category, setCategory] = useState('technical');
    const [priority, setPriority] = useState('medium');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setError('');
        if (subject.trim().length < 5) {
            setError('Please give a short subject (at least 5 characters).');
            return;
        }
        if (description.trim().length < 20) {
            setError('Please describe the issue in a bit more detail (at least 20 characters) — it helps our team resolve it faster.');
            return;
        }

        setSubmitting(true);
        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Medium);
        try {
            const res = await ticketService.createTicket({
                category,
                priority,
                subject: subject.trim(),
                description: description.trim(),
                ownerEmail: user?.email || undefined,
                ownerPhone: user?.phone || undefined,
            });
            setResult(res);
        } catch (e) {
            const msg = e.response?.data?.detail || e.message || 'Could not submit your ticket. Please check your connection and try again.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (result) {
        return (
            <View style={[GlobalStyles.screen, styles.center]}>
                <Ionicons name="checkmark-circle" size={72} color={Theme.colors.positive} />
                <Text style={[styles.successTitle, { color: Theme.colors.text }]}>Ticket raised</Text>
                <Text style={[styles.successId, { color: Theme.colors.primary }]}>{result.ticket_id}</Text>
                <Text style={[styles.successMsg, { color: Theme.colors.textMuted }]}>{result.message}</Text>
                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: Theme.colors.primary }]}
                    onPress={() => navigation.navigate('MyTickets')}
                >
                    <Text style={styles.primaryBtnText}>View my tickets</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={[styles.linkBtn, { color: Theme.colors.secondary }]}>Done</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={GlobalStyles.screen}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: Theme.colors.text }]}>Raise a ticket</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={[GlobalStyles.label, styles.sectionLabel]}>What's this about?</Text>
                <View style={styles.chipRow}>
                    {CATEGORIES.map(c => (
                        <TouchableOpacity
                            key={c.key}
                            style={[
                                styles.chip,
                                { borderColor: Theme.colors.border },
                                category === c.key && { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
                            ]}
                            onPress={() => setCategory(c.key)}
                        >
                            <Text style={[
                                styles.chipText,
                                { color: category === c.key ? '#FFF' : Theme.colors.text },
                            ]}>{c.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={[GlobalStyles.label, styles.sectionLabel]}>How urgent is it?</Text>
                <View style={styles.chipRow}>
                    {PRIORITIES.map(p => (
                        <TouchableOpacity
                            key={p.key}
                            style={[
                                styles.chip,
                                { borderColor: Theme.colors.border },
                                priority === p.key && { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
                            ]}
                            onPress={() => setPriority(p.key)}
                        >
                            <Text style={[
                                styles.chipText,
                                { color: priority === p.key ? '#FFF' : Theme.colors.text },
                            ]}>{p.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={[GlobalStyles.label, styles.sectionLabel]}>Subject</Text>
                <TextInput
                    style={[styles.input, { borderColor: Theme.colors.border, color: Theme.colors.text }]}
                    placeholder="e.g. Can't download my last invoice"
                    placeholderTextColor={Theme.colors.textMuted}
                    value={subject}
                    onChangeText={setSubject}
                    maxLength={120}
                />

                <Text style={[GlobalStyles.label, styles.sectionLabel]}>Describe the issue</Text>
                <TextInput
                    style={[styles.input, styles.textArea, { borderColor: Theme.colors.border, color: Theme.colors.text }]}
                    placeholder="What happened, what did you expect, and when did it start?"
                    placeholderTextColor={Theme.colors.textMuted}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                />

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: Theme.colors.primary, marginTop: 24 }, submitting && { opacity: 0.7 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting
                        ? <ActivityIndicator color="#FFF" />
                        : <Text style={styles.primaryBtnText}>Submit ticket</Text>}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 16 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontFamily: Theme.fonts.headingSemi },
    content: { paddingHorizontal: 20, paddingBottom: 60 },
    sectionLabel: { marginTop: 20, marginBottom: 10 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, marginRight: 8, marginBottom: 8 },
    chipText: { fontSize: 13, fontFamily: Theme.fonts.body },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: Theme.fonts.body },
    textArea: { minHeight: 120 },
    errorText: { color: '#EF4444', marginTop: 14, fontSize: 13, fontFamily: Theme.fonts.body },
    primaryBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { color: '#FFF', fontSize: 15, fontFamily: Theme.fonts.headingSemi },
    linkBtn: { marginTop: 16, fontSize: 14, fontFamily: Theme.fonts.body },
    center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    successTitle: { fontSize: 20, fontFamily: Theme.fonts.headingSemi, marginTop: 16 },
    successId: { fontSize: 22, fontFamily: Theme.fonts.heading, marginTop: 8, letterSpacing: 1 },
    successMsg: { fontSize: 14, fontFamily: Theme.fonts.body, textAlign: 'center', marginTop: 12, marginBottom: 28, lineHeight: 20 },
});
