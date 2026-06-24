import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Modal, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, GlobalStyles } from '../theme';
import HapticUtils from '../utils/HapticUtils';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { clinicalService } from '../services/clinicalService';

export default function PrescriptionDetailScreen({ route, navigation }) {
    const { prescription } = route.params;
    const [showShareModal, setShowShareModal] = useState(false);
    const [pharmacyId, setPharmacyId] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const shareExternally = async () => {
        try {
            const medList = prescription.medications.map(m => `- ${m.name} (${m.dosage})`).join('\n');
            const message = `Digital Prescription from Hospyn\n\nDiagnosis: ${prescription.diagnosis}\nDate: ${new Date(prescription.created_at).toLocaleDateString()}\n\nMedications:\n${medList}\n\nRef: ${prescription.id}`;
            
            if (Platform.OS === 'web' && (!navigator.share || !navigator.canShare)) {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(message);
                    Alert.alert('Success', 'Prescription details copied to clipboard!');
                } else {
                    Alert.alert('Error', 'Clipboard access not available.');
                }
            } else {
                await Share.share({ message });
            }
        } catch (error) {
            console.error('[Share Error]:', error);
            Alert.alert('Sharing Failed', 'Could not share or copy prescription details.');
        }
    };

    const shareInternally = async () => {
        if (!pharmacyId) return Alert.alert('Error', 'Please enter a Pharmacy ID or scan a QR');
        setIsSharing(true);
        try {
            // FIX-RX1 (2026-06-24): was calling /referrals/pharmacies/request,
            // which never existed. Now hits the real, already-built
            // /prescriptions/{id}/share endpoint — works for any pharmacy
            // account in the system, not a narrow referral list.
            await clinicalService.submitPartnerPharmacyRequest(prescription.id, pharmacyId);
            setShowShareModal(false);
            setPharmacyId('');
            Alert.alert('Success', 'Prescription securely shared with Pharmacy!');
        } catch (error) {
            const msg = error.response?.data?.detail || 'Failed to share. Make sure the Pharmacy ID is correct.';
            Alert.alert('Error', msg);
        } finally {
            setIsSharing(false);
        }
    };

    const handleBarcodeScanned = ({ data }) => {
        setIsScanning(false);
        setPharmacyId(data);
        Alert.alert('QR Scanned', `Scanned Pharmacy ID: ${data}`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Share Now', onPress: shareInternally }
        ]);
    };

    return (
        <View style={GlobalStyles.screen}>
            <LinearGradient colors={['#0F172A', '#050810']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={[GlobalStyles.heading, styles.headerTitle]}>PRESCRIPTION DETAILS</Text>
                <View style={{ width: 24 }} />
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.infoCard, GlobalStyles.glass]}>
                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.sectionLabel}>PRESCRIBING PHYSICIAN</Text>
                        <Text style={styles.diagnosisText}>{prescription.doctor_name || 'Hospyn Clinician'}</Text>
                        <Text style={styles.metaLabel}>HOSPITAL / CLINIC</Text>
                        <Text style={styles.metaValue}>{prescription.hospital_name || 'Hospyn Network Facility'}</Text>
                    </View>
                    
                    <Text style={styles.sectionLabel}>DIAGNOSIS</Text>
                    <Text style={styles.diagnosisText}>{prescription.diagnosis || 'Clinical Consultation'}</Text>
                    
                    <View style={styles.metaRow}>
                        <View>
                            <Text style={styles.metaLabel}>DATE</Text>
                            <Text style={styles.metaValue}>{new Date(prescription.created_at).toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View>
                            <Text style={styles.metaLabel}>TIME</Text>
                            <Text style={styles.metaValue}>{new Date(prescription.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View>
                            <Text style={styles.metaLabel}>STATUS</Text>
                            <Text style={[styles.metaValue, { color: prescription.status === 'fulfilled' ? '#10B981' : Theme.colors.primary }]}>{prescription.status.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.medicationHeading}>MEDICATIONS</Text>
                
                {prescription.medications.map((med, index) => (
                    <View key={index} style={[styles.medCard, GlobalStyles.glass]}>
                        <View style={styles.medHeader}>
                            <View style={styles.medIconBox}>
                                <MaterialCommunityIcons name="pill" size={20} color={Theme.colors.primary} />
                            </View>
                            <Text style={styles.medName}>{med.name}</Text>
                        </View>
                        
                        <View style={styles.instructionGrid}>
                            <View style={styles.instructionItem}>
                                <Text style={styles.instLabel}>DOSAGE</Text>
                                <Text style={styles.instValue}>{med.dosage}</Text>
                            </View>
                            <View style={styles.instructionItem}>
                                <Text style={styles.instLabel}>FREQUENCY</Text>
                                <Text style={styles.instValue}>{med.frequency}</Text>
                            </View>
                            <View style={styles.instructionItem}>
                                <Text style={styles.instLabel}>DURATION</Text>
                                <Text style={styles.instValue}>{med.duration}</Text>
                            </View>
                        </View>

                        {med.instructions && (
                            <View style={styles.notesBox}>
                                <Ionicons name="information-circle-outline" size={16} color="#6366F1" />
                                <Text style={styles.notesText}>{med.instructions}</Text>
                            </View>
                        )}
                    </View>
                ))}

                {prescription.notes && (
                    <>
                        <Text style={styles.medicationHeading}>CLINICAL NOTES</Text>
                        <View style={[styles.infoCard, GlobalStyles.glass]}>
                            <Text style={styles.notesContent}>{prescription.notes}</Text>
                        </View>
                    </>
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>THIS IS A DIGITALLY SIGNED CLINICAL ORDER</Text>
                    <Text style={styles.footerId}>REF: {prescription.id.substring(0, 8).toUpperCase()}</Text>
                    {prescription.qr_code_id && (
                        <View style={{ marginTop: 20, padding: 10, backgroundColor: '#fff', borderRadius: 12 }}>
                            <QRCode value={prescription.qr_code_id} size={100} />
                        </View>
                    )}
                </View>

                {/* Ask Chitti Button */}
                <TouchableOpacity 
                    style={[styles.actionBtnPrimary, { backgroundColor: '#10B981', marginTop: 30, marginBottom: 10 }]} 
                    onPress={() => navigation.navigate('Chitti AI', { 
                        initialMessage: `Hi Chitti, explain my recent prescription from ${prescription.doctor_name || 'my doctor'}. I have been diagnosed with ${prescription.diagnosis || 'an illness'}. What are these medications for?` 
                    })}
                >
                    <MaterialCommunityIcons name="robot-outline" size={20} color="#fff" />
                    <Text style={styles.actionBtnTextPrimary}>ASK CHITTI AI</Text>
                </TouchableOpacity>

                {/* Share Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity style={styles.actionBtnSecondary} onPress={shareExternally}>
                        <Ionicons name="share-outline" size={20} color="#6366F1" />
                        <Text style={styles.actionBtnTextSecondary}>SHARE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setShowShareModal(true)}>
                        <Ionicons name="qr-code-outline" size={20} color="#fff" />
                        <Text style={styles.actionBtnTextPrimary}>HOSPYN PHARMACY</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Share to Hospyn Pharmacy Modal */}
            <Modal visible={showShareModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>SHARE WITH PHARMACY</Text>
                            <TouchableOpacity onPress={() => setShowShareModal(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSub}>Enter the Pharmacy's Hospyn ID to instantly beam this prescription to their queue.</Text>
                        
                        {isScanning ? (
                            <View style={{ height: 300, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                                <CameraView 
                                    style={{ flex: 1 }} 
                                    facing="back"
                                    onBarcodeScanned={handleBarcodeScanned}
                                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                                />
                                <TouchableOpacity style={{ position: 'absolute', top: 10, right: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }} onPress={() => setIsScanning(false)}>
                                    <Ionicons name="close" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="e.g. Hospyn-PHARMA-123" 
                                    placeholderTextColor="#64748B"
                                    value={pharmacyId}
                                    onChangeText={setPharmacyId}
                                    autoCapitalize="characters"
                                />
                                <TouchableOpacity 
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#6366F1', marginBottom: 20 }}
                                    onPress={async () => {
                                        if (!permission?.granted) await requestPermission();
                                        setIsScanning(true);
                                    }}
                                >
                                    <Ionicons name="qr-code" size={20} color="#6366F1" />
                                    <Text style={{ color: '#6366F1', fontSize: 12, fontWeight: 'bold' }}>SCAN PHARMACY QR</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        
                        <TouchableOpacity style={styles.sendBtn} onPress={shareInternally} disabled={isSharing}>
                            {isSharing ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>BEAM PRESCRIPTION</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 16, letterSpacing: 2 },
    backBtn: { padding: 4 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    infoCard: { padding: 20, borderRadius: 24, marginBottom: 25 },
    sectionLabel: { color: '#6366F1', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 },
    diagnosisText: { color: Theme.colors.text, fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    metaLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
    metaValue: { color: Theme.colors.text, fontSize: 14, fontWeight: 'bold' },
    divider: { width: 1, height: 30, backgroundColor: 'rgba(150,150,150,0.2)' },
    medicationHeading: { color: Theme.colors.text, fontSize: 14, fontWeight: 'bold', letterSpacing: 1, marginBottom: 15, marginLeft: 5 },
    medCard: { padding: 20, borderRadius: 24, marginBottom: 12 },
    medHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
    medIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.1)', justifyContent: 'center', alignItems: 'center' },
    medName: { color: Theme.colors.text, fontSize: 18, fontWeight: 'bold' },
    instructionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    instructionItem: { flex: 1 },
    instLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
    instValue: { color: Theme.colors.text, fontSize: 13, fontWeight: '600' },
    notesBox: { marginTop: 15, padding: 12, backgroundColor: 'rgba(99,102,241,0.05)', borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
    notesText: { color: Theme.colors.textMuted, fontSize: 12, flex: 1 },
    notesContent: { color: Theme.colors.textMuted, fontSize: 14, lineHeight: 22 },
    footer: { marginTop: 30, alignItems: 'center' },
    footerText: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    footerId: { color: Theme.colors.textMuted, fontSize: 9, marginTop: 4 },
    actionBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)' },
    actionBtnTextSecondary: { color: '#6366F1', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    actionBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#6366F1' },
    actionBtnTextPrimary: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Theme.colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 50 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    modalSub: { color: '#94A3B8', fontSize: 14, marginBottom: 20, lineHeight: 22 },
    input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#fff', padding: 16, borderRadius: 16, fontSize: 16, marginBottom: 20 },
    sendBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 16, alignItems: 'center' },
    sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 }
});
