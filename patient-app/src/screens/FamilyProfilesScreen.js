import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, TextInput, ActivityIndicator, Alert,
    Modal, Dimensions, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { Theme, GlobalStyles, getTheme, subscribeToTheme } from '../theme';
import ApiService from '../utils/ApiService';
import { SecurityUtils } from '../utils/security';
import { useAuth } from '../contexts/AuthContext';
import HapticUtils from '../utils/HapticUtils';

const { width } = Dimensions.get('window');

const RELATIONS = ["Mother", "Father", "Brother", "Sister", "Husband", "Wife", "Son", "Daughter", "Other"];

const RELATION_ICONS = {
    Mother: 'heart', Father: 'shield', Brother: 'people', Sister: 'people',
    Husband: 'heart-circle', Wife: 'heart-circle', Son: 'person', Daughter: 'person', Other: 'person-add',
};

export default function FamilyProfilesScreen({ navigation }) {
    const { user, switchProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState([]);
    const [activeMemberId, setActiveMemberId] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [qrModal, setQrModal] = useState(null); // holds { name, hospyn_id }
    const [selectedRelation, setSelectedRelation] = useState('');
    const [newMember, setNewMember] = useState({ fullName: '', phone: '' });

    const [, setThemeState] = useState(getTheme());
    useEffect(() => {
        return subscribeToTheme((newTheme) => {
            setThemeState(newTheme);
        });
    }, []);

    const load = async () => {
        setLoading(true);
        const activeId = await SecurityUtils.getActiveMemberId();
        setActiveMemberId(activeId);
        try {
            const data = await ApiService.client.get('/patient/care-circle');
            setProfiles(Array.isArray(data.data) ? data.data : []);
        } catch (e) {
            console.error('Care circle fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    const handleSwitch = async (memberId) => {
        HapticUtils.success();
        await SecurityUtils.saveActiveMemberId(memberId);
        setActiveMemberId(memberId);
        // Refresh global auth context so all screens update immediately
        await switchProfile(memberId);
        // Navigate directly — no alert dialog
        navigation.navigate('Home');
    };

    const handleAddMember = async () => {
        if (!newMember.fullName.trim() || !selectedRelation) {
            return Alert.alert('Missing Info', 'Please enter the name and select a relationship.');
        }
        setSubmitting(true);
        try {
            const payload = {
                full_name: newMember.fullName.trim(),
                relation: selectedRelation,
                phone_number: newMember.phone || null,
                blood_group: 'Unknown',
                gender: 'Other',
            };
            const response = await ApiService.client.post('/patient/care-circle', payload);
            if (response.data?.id) {
                HapticUtils.success();
                setProfiles(prev => [...prev, response.data]);
                setIsAdding(false);
                setNewMember({ fullName: '', phone: '' });
                setSelectedRelation('');
            }
        } catch (e) {
            Alert.alert('Error', 'Could not add family member. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatFamilyHospynId = (idStr, relation) => {
        if (!idStr) return '';
        const str = idStr.toString();
        const relUpper = relation ? `-${relation.toUpperCase()}` : '';
        if (relUpper && str.endsWith(relUpper)) {
            const base = str.substring(0, str.length - relUpper.length);
            return `${base}-FM-0824`;
        }
        return str;
    };

    const handleDeleteMember = async (memberId, name) => {
        HapticUtils.warning();
        const executeDelete = async () => {
            setLoading(true);
            try {
                await ApiService.client.delete(`/patient/care-circle/${memberId}`);
                HapticUtils.success();
                if (activeMemberId === memberId) {
                    await SecurityUtils.saveActiveMemberId(null);
                    await switchProfile(null);
                }
                load();
            } catch (e) {
                // Cross platform alert fallback
                if (Platform.OS === 'web') {
                    window.alert('Could not remove family member. Please try again.');
                } else {
                    Alert.alert('Error', 'Could not remove family member. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        };

        const msg = `Are you sure you want to remove ${name} from your Care Circle?\n\nThis will disconnect access to their health vault.`;
        if (Platform.OS === 'web') {
            const confirmed = window.confirm(msg);
            if (confirmed) {
                await executeDelete();
            }
        } else {
            Alert.alert(
                'Remove Family Member',
                msg,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: executeDelete }
                ]
            );
        }
    };

    const primaryHospynId = user?.hospyn_id || 'YOUR-ID';
    const bgGradient = Theme.colors.background === '#050810' 
        ? ['#0A0F1E', '#050810'] 
        : ['#FFFFFF', '#F8F7FF'];

    const inputPlaceholderColor = Theme.colors.background === '#050810' ? '#475569' : '#94A3B8';
    const inputIconColor = Theme.colors.background === '#050810' ? '#475569' : '#94A3B8';

    return (
        <View style={[styles.container, { backgroundColor: Theme.colors.background }]}>
            <LinearGradient colors={bgGradient} style={StyleSheet.absoluteFill} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: Theme.colors.background === '#050810' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                    <Ionicons name="chevron-back" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
                <View>
                    <Text style={[styles.headerTitle, { color: Theme.colors.text }]}>CARE CIRCLE</Text>
                    <Text style={[styles.headerSub, { color: Theme.colors.textMuted }]}>Family Health Network</Text>
                </View>
                <TouchableOpacity style={styles.addIconBtn} onPress={() => { HapticUtils.light(); setIsAdding(v => !v); }}>
                    <Ionicons name={isAdding ? 'close' : 'add'} size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Primary Profile Card */}
                <Animated.View entering={FadeInDown.delay(50)}>
                    <LinearGradient colors={Theme.colors.background === '#050810' ? ['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)'] : ['rgba(124,58,237,0.12)', 'rgba(124,58,237,0.04)']} style={[styles.primaryCard, activeMemberId == null && styles.activeHighlight]}>
                        <View style={styles.cardRow}>
                            <View style={[styles.avatar, { backgroundColor: Theme.colors.background === '#050810' ? 'rgba(99,102,241,0.3)' : 'rgba(124,58,237,0.15)' }]}>
                                <Ionicons name="person" size={22} color={Theme.colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.memberName, { color: Theme.colors.text }]}>{user?.full_name || 'My Profile'}</Text>
                                <Text style={styles.hospynIdLabel}>{primaryHospynId}</Text>
                                <Text style={[styles.relationTag, { color: Theme.colors.textMuted }]}>PRIMARY ACCOUNT</Text>
                            </View>
                            <View style={styles.rightActions}>
                                <TouchableOpacity style={styles.qrBtn} onPress={() => setQrModal({ name: user?.full_name, hospyn_id: primaryHospynId })}>
                                    <Ionicons name="qr-code" size={20} color={Theme.colors.primary} />
                                </TouchableOpacity>
                                {activeMemberId != null && (
                                    <TouchableOpacity style={styles.switchBtn} onPress={() => handleSwitch(null)}>
                                        <Text style={styles.switchBtnText}>SWITCH</Text>
                                    </TouchableOpacity>
                                )}
                                {activeMemberId == null && (
                                    <View style={styles.activeBadge}>
                                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* Add Member Form */}
                {isAdding && (
                    <Animated.View entering={FadeInDown} style={[styles.addCard, { backgroundColor: Theme.colors.background === '#050810' ? 'rgba(99,102,241,0.04)' : 'rgba(124,58,237,0.04)', borderColor: Theme.colors.background === '#050810' ? 'rgba(99,102,241,0.15)' : 'rgba(124,58,237,0.15)' }]}>
                        <Text style={[styles.addCardTitle, { color: Theme.colors.text }]}>Add Family Member</Text>
                        <Text style={[styles.addCardSub, { color: Theme.colors.textMuted }]}>Each member gets a unique Hospyn ID & QR code</Text>

                        <Text style={[styles.fieldLabel, { color: Theme.colors.primary }]}>RELATIONSHIP</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relationRow}>
                            {RELATIONS.map(r => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.relationChip, selectedRelation === r && styles.relationChipActive]}
                                    onPress={() => { HapticUtils.selection(); setSelectedRelation(r); }}
                                >
                                    <Ionicons name={RELATION_ICONS[r] || 'person'} size={14} color={selectedRelation === r ? '#fff' : Theme.colors.primary} />
                                    <Text style={[styles.relationChipText, { color: Theme.colors.primary }, selectedRelation === r && { color: '#fff' }]}>{r}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={[styles.fieldLabel, { color: Theme.colors.primary }]}>FULL NAME</Text>
                        <View style={[styles.inputBox, { backgroundColor: Theme.colors.background === '#050810' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)', borderColor: Theme.colors.background === '#050810' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }]}>
                            <Ionicons name="person-outline" size={16} color={inputIconColor} />
                            <TextInput
                                style={[styles.input, { color: Theme.colors.text }]}
                                placeholder="Enter full name"
                                placeholderTextColor={inputPlaceholderColor}
                                value={newMember.fullName}
                                onChangeText={v => setNewMember(p => ({ ...p, fullName: v }))}
                            />
                        </View>

                        <Text style={[styles.fieldLabel, { color: Theme.colors.primary }]}>MOBILE (OPTIONAL)</Text>
                        <View style={[styles.inputBox, { backgroundColor: Theme.colors.background === '#050810' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)', borderColor: Theme.colors.background === '#050810' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }]}>
                            <Ionicons name="call-outline" size={16} color={inputIconColor} />
                            <TextInput
                                style={[styles.input, { color: Theme.colors.text }]}
                                placeholder="For alerts & coordination"
                                placeholderTextColor={inputPlaceholderColor}
                                keyboardType="phone-pad"
                                value={newMember.phone}
                                onChangeText={v => setNewMember(p => ({ ...p, phone: v }))}
                            />
                        </View>

                        <TouchableOpacity style={styles.submitBtn} onPress={handleAddMember} disabled={submitting}>
                            <LinearGradient colors={Theme.colors.background === '#050810' ? ['#6366F1', '#4F46E5'] : ['#7C3AED', '#6D28D9']} style={styles.submitGradient}>
                                {submitting
                                    ? <ActivityIndicator color="#fff" />
                                    : <><Ionicons name="person-add" size={16} color="#fff" /><Text style={styles.submitText}>Add to Care Circle</Text></>
                                }
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Section Label */}
                {profiles.length > 0 && (
                    <Text style={[styles.sectionLabel, { color: Theme.colors.textMuted }]}>FAMILY MEMBERS ({profiles.length})</Text>
                )}

                {/* Loading */}
                {loading ? (
                    <ActivityIndicator color={Theme.colors.primary} style={{ marginTop: 40 }} />
                ) : profiles.length === 0 && !isAdding ? (
                    <Animated.View entering={FadeInUp} style={styles.emptyState}>
                        <Ionicons name="people-outline" size={60} color={Theme.colors.background === '#050810' ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} />
                        <Text style={[styles.emptyTitle, { color: Theme.colors.text }]}>Care Circle is Empty</Text>
                        <Text style={[styles.emptySub, { color: Theme.colors.textMuted }]}>Add family members to manage their health records and switch contexts instantly.</Text>
                        <TouchableOpacity style={[styles.emptyAction, { backgroundColor: Theme.colors.background === '#050810' ? 'rgba(99,102,241,0.15)' : 'rgba(124,58,237,0.08)', borderColor: Theme.colors.background === '#050810' ? 'rgba(99,102,241,0.3)' : 'rgba(124,58,237,0.2)' }]} onPress={() => { HapticUtils.light(); setIsAdding(true); }}>
                            <Text style={[styles.emptyActionText, { color: Theme.colors.primary }]}>+ Add First Member</Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    profiles.map((p, i) => {
                        const cleanedHospynId = formatFamilyHospynId(p.linked_hospyn_id || p.id, p.relation);
                        return (
                            <Animated.View key={p.id} entering={FadeInUp.delay(i * 80)}>
                                <View style={[styles.memberCard, { backgroundColor: Theme.colors.background === '#050810' ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: Theme.colors.background === '#050810' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }, activeMemberId === p.id && styles.activeHighlight]}>
                                    <View style={styles.cardRow}>
                                        <View style={[styles.avatar, { backgroundColor: Theme.colors.background === '#050810' ? 'rgba(34,211,238,0.1)' : 'rgba(124,58,237,0.1)' }]}>
                                            <Ionicons name={RELATION_ICONS[p.relation] || 'person'} size={22} color={Theme.colors.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.memberName, { color: Theme.colors.text }]}>{p.full_name}</Text>
                                            <Text style={styles.hospynIdLabel}>{cleanedHospynId}</Text>
                                            <Text style={[styles.relationTag, { color: Theme.colors.textMuted }]}>{p.relation?.toUpperCase()}</Text>
                                        </View>
                                        <View style={styles.rightActions}>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {/* Trash/Delete Button */}
                                                <TouchableOpacity 
                                                    style={styles.deleteIconBtn} 
                                                    onPress={() => handleDeleteMember(p.id, p.full_name)}
                                                >
                                                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                                </TouchableOpacity>

                                                <TouchableOpacity style={styles.qrBtn} onPress={() => { HapticUtils.light(); setQrModal({ name: p.full_name, hospyn_id: cleanedHospynId }); }}>
                                                    <Ionicons name="qr-code" size={18} color={Theme.colors.primary} />
                                                </TouchableOpacity>
                                            </View>
                                            {activeMemberId === p.id ? (
                                                <View style={styles.activeBadge}>
                                                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                                                </View>
                                            ) : (
                                                <TouchableOpacity style={styles.switchBtn} onPress={() => handleSwitch(p.id)}>
                                                    <Text style={styles.switchBtnText}>SWITCH</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </Animated.View>
                        );
                    })
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* QR Code Modal */}
            <Modal visible={!!qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(null)}>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={FadeInUp} style={[styles.qrModalCard, { backgroundColor: Theme.colors.background === '#050810' ? '#0F172A' : '#FFFFFF', borderColor: Theme.colors.background === '#050810' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                        <Text style={[styles.qrModalName, { color: Theme.colors.text }]}>{qrModal?.name}</Text>
                        <Text style={styles.qrModalId}>{qrModal?.hospyn_id}</Text>
                        <View style={styles.qrBox}>
                            {qrModal?.hospyn_id ? (
                                <QRCode
                                    value={qrModal.hospyn_id}
                                    size={200}
                                    color="#0F172A"
                                    backgroundColor="#F8FAFC"
                                    logo={undefined}
                                />
                            ) : null}
                        </View>
                        <Text style={[styles.qrHint, { color: Theme.colors.textMuted }]}>Show this QR at any Hospyn-enabled hospital for instant record access</Text>
                        <TouchableOpacity style={[styles.qrCloseBtn, { backgroundColor: Theme.colors.background === '#050810' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} onPress={() => { HapticUtils.light(); setQrModal(null); }}>
                            <Text style={[styles.qrCloseBtnText, { color: Theme.colors.textMuted }]}>CLOSE</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            {/* Footer */}
            <View style={styles.footer}>
                <Ionicons name="lock-closed" size={10} color="#10b981" />
                <Text style={styles.footerText}>BLOOD-LINE COORDINATION ENCRYPTED · ISO 27001</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    addIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 2 },
    headerSub: { fontSize: 10, marginTop: 2 },
    scroll: { paddingHorizontal: 20, paddingTop: 4 },
    primaryCard: { borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
    memberCard: { borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1 },
    activeHighlight: { borderColor: '#10B981', borderWidth: 1.5 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    memberName: { fontSize: 15, fontWeight: '700' },
    hospynIdLabel: { color: '#6366F1', fontSize: 11, fontWeight: 'bold', marginTop: 2, letterSpacing: 0.5 },
    relationTag: { fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginTop: 3 },
    rightActions: { alignItems: 'flex-end', gap: 8 },
    qrBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.12)', justifyContent: 'center', alignItems: 'center' },
    deleteIconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.12)', justifyContent: 'center', alignItems: 'center' },
    switchBtn: { backgroundColor: 'rgba(34,211,238,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(34,211,238,0.2)' },
    switchBtnText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
    activeBadgeText: { color: '#10B981', fontSize: 9, fontWeight: '900' },
    sectionLabel: { fontSize: 9, fontWeight: 'bold', letterSpacing: 2, marginBottom: 12, marginTop: 8 },
    addCard: { borderRadius: 28, padding: 24, marginBottom: 20, borderWidth: 1 },
    addCardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    addCardSub: { fontSize: 12, marginBottom: 24 },
    fieldLabel: { fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
    relationRow: { marginBottom: 20 },
    relationChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', backgroundColor: 'rgba(124,58,237,0.06)', marginRight: 8 },
    relationChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    relationChipText: { fontSize: 12, fontWeight: '600' },
    inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 16, height: 54, borderWidth: 1, marginBottom: 16 },
    input: { flex: 1, fontSize: 15 },
    submitBtn: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
    submitGradient: { height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    submitText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20 },
    emptySub: { fontSize: 13, textAlign: 'center', marginTop: 10, marginHorizontal: 20, lineHeight: 20 },
    emptyAction: { marginTop: 24, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1 },
    emptyActionText: { fontWeight: 'bold', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 30 },
    qrModalCard: { borderRadius: 32, padding: 32, alignItems: 'center', borderWidth: 1, width: '100%' },
    qrModalName: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
    qrModalId: { color: '#7C3AED', fontSize: 13, fontWeight: 'bold', marginTop: 6, marginBottom: 28, letterSpacing: 1 },
    qrBox: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 20, marginBottom: 24 },
    qrHint: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
    qrCloseBtn: { borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14 },
    qrCloseBtnText: { fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
    footerText: { color: '#10b981', fontSize: 8, fontWeight: 'bold', letterSpacing: 1 },
});
