import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, TextInput, ActivityIndicator, Alert,
    Modal, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { Theme, GlobalStyles } from '../theme';
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

    const primaryHospynId = user?.hospyn_id || 'YOUR-ID';

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0A0F1E', '#050810']} style={StyleSheet.absoluteFill} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>CARE CIRCLE</Text>
                    <Text style={styles.headerSub}>Family Health Network</Text>
                </View>
                <TouchableOpacity style={styles.addIconBtn} onPress={() => { HapticUtils.light(); setIsAdding(v => !v); }}>
                    <Ionicons name={isAdding ? 'close' : 'add'} size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Primary Profile Card */}
                <Animated.View entering={FadeInDown.delay(50)}>
                    <LinearGradient colors={['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)']} style={[styles.primaryCard, activeMemberId == null && styles.activeHighlight]}>
                        <View style={styles.cardRow}>
                            <View style={[styles.avatar, { backgroundColor: 'rgba(99,102,241,0.3)' }]}>
                                <Ionicons name="person" size={22} color="#6366F1" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.memberName}>{user?.full_name || 'My Profile'}</Text>
                                <Text style={styles.hospynIdLabel}>{primaryHospynId}</Text>
                                <Text style={styles.relationTag}>PRIMARY ACCOUNT</Text>
                            </View>
                            <View style={styles.rightActions}>
                                <TouchableOpacity style={styles.qrBtn} onPress={() => setQrModal({ name: user?.full_name, hospyn_id: primaryHospynId })}>
                                    <Ionicons name="qr-code" size={20} color="#6366F1" />
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
                    <Animated.View entering={FadeInDown} style={styles.addCard}>
                        <Text style={styles.addCardTitle}>Add Family Member</Text>
                        <Text style={styles.addCardSub}>Each member gets a unique Hospyn ID & QR code</Text>

                        <Text style={styles.fieldLabel}>RELATIONSHIP</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relationRow}>
                            {RELATIONS.map(r => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.relationChip, selectedRelation === r && styles.relationChipActive]}
                                    onPress={() => { HapticUtils.selection(); setSelectedRelation(r); }}
                                >
                                    <Ionicons name={RELATION_ICONS[r] || 'person'} size={14} color={selectedRelation === r ? '#fff' : '#6366F1'} />
                                    <Text style={[styles.relationChipText, selectedRelation === r && { color: '#fff' }]}>{r}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.fieldLabel}>FULL NAME</Text>
                        <View style={styles.inputBox}>
                            <Ionicons name="person-outline" size={16} color="#475569" />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter full name"
                                placeholderTextColor="#475569"
                                value={newMember.fullName}
                                onChangeText={v => setNewMember(p => ({ ...p, fullName: v }))}
                            />
                        </View>

                        <Text style={styles.fieldLabel}>MOBILE (OPTIONAL)</Text>
                        <View style={styles.inputBox}>
                            <Ionicons name="call-outline" size={16} color="#475569" />
                            <TextInput
                                style={styles.input}
                                placeholder="For alerts & coordination"
                                placeholderTextColor="#475569"
                                keyboardType="phone-pad"
                                value={newMember.phone}
                                onChangeText={v => setNewMember(p => ({ ...p, phone: v }))}
                            />
                        </View>

                        <TouchableOpacity style={styles.submitBtn} onPress={handleAddMember} disabled={submitting}>
                            <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.submitGradient}>
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
                    <Text style={styles.sectionLabel}>FAMILY MEMBERS ({profiles.length})</Text>
                )}

                {/* Loading */}
                {loading ? (
                    <ActivityIndicator color={Theme.colors.primary} style={{ marginTop: 40 }} />
                ) : profiles.length === 0 && !isAdding ? (
                    <Animated.View entering={FadeInUp} style={styles.emptyState}>
                        <Ionicons name="people-outline" size={60} color="rgba(255,255,255,0.08)" />
                        <Text style={styles.emptyTitle}>Care Circle is Empty</Text>
                        <Text style={styles.emptySub}>Add family members to manage their health records and switch contexts instantly.</Text>
                        <TouchableOpacity style={styles.emptyAction} onPress={() => { HapticUtils.light(); setIsAdding(true); }}>
                            <Text style={styles.emptyActionText}>+ Add First Member</Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    profiles.map((p, i) => (
                        <Animated.View key={p.id} entering={FadeInUp.delay(i * 80)}>
                            <View style={[styles.memberCard, activeMemberId === p.id && styles.activeHighlight]}>
                                <View style={styles.cardRow}>
                                    <View style={[styles.avatar, { backgroundColor: 'rgba(34,211,238,0.1)' }]}>
                                        <Ionicons name={RELATION_ICONS[p.relation] || 'person'} size={22} color={Theme.colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.memberName}>{p.full_name}</Text>
                                        <Text style={styles.hospynIdLabel}>{p.linked_hospyn_id || p.id?.toString().substring(0, 8).toUpperCase()}</Text>
                                        <Text style={styles.relationTag}>{p.relation?.toUpperCase()}</Text>
                                    </View>
                                    <View style={styles.rightActions}>
                                        <TouchableOpacity style={styles.qrBtn} onPress={() => { HapticUtils.light(); setQrModal({ name: p.full_name, hospyn_id: p.linked_hospyn_id || p.id }); }}>
                                            <Ionicons name="qr-code" size={20} color={Theme.colors.primary} />
                                        </TouchableOpacity>
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
                    ))
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* QR Code Modal */}
            <Modal visible={!!qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(null)}>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={FadeInUp} style={styles.qrModalCard}>
                        <Text style={styles.qrModalName}>{qrModal?.name}</Text>
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
                        <Text style={styles.qrHint}>Show this QR at any Hospyn-enabled hospital for instant record access</Text>
                        <TouchableOpacity style={styles.qrCloseBtn} onPress={() => { HapticUtils.light(); setQrModal(null); }}>
                            <Text style={styles.qrCloseBtnText}>CLOSE</Text>
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
    container: { flex: 1, backgroundColor: '#050810' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    addIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
    headerSub: { color: '#475569', fontSize: 10, marginTop: 2 },
    scroll: { paddingHorizontal: 20, paddingTop: 4 },
    primaryCard: { borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
    memberCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    activeHighlight: { borderColor: '#10B981', borderWidth: 1.5 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    memberName: { color: '#fff', fontSize: 15, fontWeight: '700' },
    hospynIdLabel: { color: '#6366F1', fontSize: 11, fontWeight: 'bold', marginTop: 2, letterSpacing: 0.5 },
    relationTag: { color: '#475569', fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginTop: 3 },
    rightActions: { alignItems: 'flex-end', gap: 8 },
    qrBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.12)', justifyContent: 'center', alignItems: 'center' },
    switchBtn: { backgroundColor: 'rgba(34,211,238,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(34,211,238,0.2)' },
    switchBtnText: { color: Theme.colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
    activeBadgeText: { color: '#10B981', fontSize: 9, fontWeight: '900' },
    sectionLabel: { color: '#334155', fontSize: 9, fontWeight: 'bold', letterSpacing: 2, marginBottom: 12, marginTop: 8 },
    addCard: { backgroundColor: 'rgba(99,102,241,0.04)', borderRadius: 28, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)' },
    addCardTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    addCardSub: { color: '#475569', fontSize: 12, marginBottom: 24 },
    fieldLabel: { color: '#6366F1', fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
    relationRow: { marginBottom: 20 },
    relationChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.06)', marginRight: 8 },
    relationChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    relationChipText: { color: '#6366F1', fontSize: 12, fontWeight: '600' },
    inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, paddingHorizontal: 16, height: 54, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 16 },
    input: { flex: 1, color: '#fff', fontSize: 15 },
    submitBtn: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
    submitGradient: { height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    submitText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
    emptyTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
    emptySub: { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 10, marginHorizontal: 20, lineHeight: 20 },
    emptyAction: { marginTop: 24, backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
    emptyActionText: { color: '#6366F1', fontWeight: 'bold', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 30 },
    qrModalCard: { backgroundColor: '#0F172A', borderRadius: 32, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', width: '100%' },
    qrModalName: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
    qrModalId: { color: '#6366F1', fontSize: 13, fontWeight: 'bold', marginTop: 6, marginBottom: 28, letterSpacing: 1 },
    qrBox: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 20, marginBottom: 24 },
    qrHint: { color: '#475569', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
    qrCloseBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14 },
    qrCloseBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
    footerText: { color: '#10b981', fontSize: 8, fontWeight: 'bold', letterSpacing: 1 },
});
