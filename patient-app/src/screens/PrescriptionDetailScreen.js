import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, GlobalStyles } from '../theme';
import { HapticUtils } from '../utils/haptics';

export default function PrescriptionDetailScreen({ route, navigation }) {
    const { prescription } = route.params;

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
                    <Text style={styles.sectionLabel}>DIAGNOSIS</Text>
                    <Text style={styles.diagnosisText}>{prescription.diagnosis || 'Clinical Consultation'}</Text>
                    
                    <View style={styles.metaRow}>
                        <View>
                            <Text style={styles.metaLabel}>DATE</Text>
                            <Text style={styles.metaValue}>{new Date(prescription.created_at).toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View>
                            <Text style={styles.metaLabel}>STATUS</Text>
                            <Text style={[styles.metaValue, { color: Theme.colors.primary }]}>{prescription.status.toUpperCase()}</Text>
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
                </View>
            </ScrollView>
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
    diagnosisText: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 30 },
    metaLabel: { color: '#475569', fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
    metaValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    divider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
    medicationHeading: { color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 1, marginBottom: 15, marginLeft: 5 },
    medCard: { padding: 20, borderRadius: 24, marginBottom: 12 },
    medHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
    medIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.1)', justifyContent: 'center', alignItems: 'center' },
    medName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    instructionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    instructionItem: { flex: 1 },
    instLabel: { color: '#475569', fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
    instValue: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
    notesBox: { marginTop: 15, padding: 12, backgroundColor: 'rgba(99,102,241,0.05)', borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
    notesText: { color: '#94A3B8', fontSize: 12, flex: 1 },
    notesContent: { color: '#94A3B8', fontSize: 14, lineHeight: 22 },
    footer: { marginTop: 30, alignItems: 'center' },
    footerText: { color: '#1E293B', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    footerId: { color: '#1E293B', fontSize: 9, marginTop: 4 }
});
