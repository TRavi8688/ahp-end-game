import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function DoctorDashboardScreen() {
    const [patients, setPatients] = useState([
        { id: '1', name: 'Rahul Sharma', room: '302', risk: 'HIGH', riskType: 'SEPSIS_PROBABLE' },
        { id: '2', name: 'Anita Devi', room: 'ICU-1', risk: 'CRITICAL', riskType: 'CARDIAC_ARREST_RISK' },
        { id: '3', name: 'John Doe', room: 'OPD', risk: 'LOW', riskType: 'ROUTINE' },
    ]);

    const PatientCard = ({ item }) => (
        <TouchableOpacity style={styles.card}>
            <View style={[styles.riskBar, { backgroundColor: item.risk === 'CRITICAL' ? '#EF4444' : item.risk === 'HIGH' ? '#F59E0B' : '#10B981' }]} />
            <View style={styles.cardInfo}>
                <Text style={styles.patientName}>{item.name}</Text>
                <Text style={styles.roomNo}>Room: {item.room}</Text>
                <Text style={styles.riskLabel}>{item.riskType}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#475569" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />
            
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeText}>Good Morning,</Text>
                    <Text style={styles.docName}>Dr. Arjun Singh</Text>
                </View>
                <TouchableOpacity style={styles.profileCircle}>
                    <Text style={styles.profileInitials}>AS</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statVal}>12</Text>
                    <Text style={styles.statLabel}>Patients</Text>
                </View>
                <View style={[styles.statBox, styles.statActive]}>
                    <Text style={[styles.statVal, { color: '#EF4444' }]}>2</Text>
                    <Text style={styles.statLabel}>Urgent</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statVal}>5</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>ACTIVE PATIENT ROUNDS</Text>
            
            <FlatList
                data={patients}
                renderItem={({ item }) => <PatientCard item={item} />}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
            />

            <TouchableOpacity style={styles.fab}>
                <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.fabGradient}>
                    <Ionicons name="add" size={30} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    welcomeText: { color: '#64748B', fontSize: 14 },
    docName: { color: '#0F172A', fontSize: 24, fontWeight: 'bold' },
    profileCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
    profileInitials: { color: '#fff', fontWeight: 'bold' },
    statsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 25 },
    statBox: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    statActive: { borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
    statVal: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
    statLabel: { fontSize: 10, color: '#64748B', marginTop: 4, fontWeight: 'bold' },
    sectionTitle: { paddingHorizontal: 24, fontSize: 10, color: '#6366F1', fontWeight: 'bold', letterSpacing: 1, marginBottom: 15 },
    listContent: { paddingHorizontal: 24 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    riskBar: { width: 4, height: 40, borderRadius: 2, marginRight: 16 },
    cardInfo: { flex: 1 },
    patientName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
    roomNo: { fontSize: 12, color: '#64748B', marginTop: 2 },
    riskLabel: { fontSize: 10, color: '#6366F1', fontWeight: 'bold', marginTop: 4 },
    fab: { position: 'absolute', right: 24, bottom: 40, width: 60, height: 60, borderRadius: 30, elevation: 8 },
    fabGradient: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center' }
});
