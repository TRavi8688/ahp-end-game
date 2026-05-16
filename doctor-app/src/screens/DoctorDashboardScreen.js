import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, 
    TouchableOpacity, FlatList, ActivityIndicator, 
    RefreshControl, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../utils/ApiService';

export default function DoctorDashboardScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [patients, setPatients] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        critical: 0,
        surgeries: 0
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [rounds, summary] = await Promise.all([
                ApiService.getAssignedPatients(),
                ApiService.getAnalytics()
            ]);
            
            setPatients(rounds);
            setStats({
                total: rounds.length,
                critical: rounds.filter(p => p.risk_level === 'CRITICAL').length,
                surgeries: summary.scheduled_surgeries || 0
            });
        } catch (error) {
            console.error("Dashboard Fetch Error:", error);
            // Fallback for demonstration if API isn't fully ready
            if (patients.length === 0) {
                setPatients([
                    { id: '1', full_name: 'Rahul Sharma', room_no: '302', risk_level: 'HIGH', status: 'STABLE' },
                    { id: '2', full_name: 'Anita Devi', room_no: 'ICU-1', risk_level: 'CRITICAL', status: 'UNSTABLE' }
                ]);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const PatientCard = ({ item }) => (
        <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })}
        >
            <View style={[
                styles.riskBar, 
                { backgroundColor: item.risk_level === 'CRITICAL' ? '#EF4444' : item.risk_level === 'HIGH' ? '#F59E0B' : '#10B981' }
            ]} />
            <View style={styles.cardInfo}>
                <Text style={styles.patientName}>{item.full_name}</Text>
                <Text style={styles.roomNo}>Room: {item.room_no || 'N/A'}</Text>
                <View style={styles.statusRow}>
                    <Text style={[styles.riskLabel, { color: item.risk_level === 'CRITICAL' ? '#EF4444' : '#6366F1' }]}>
                        {item.risk_level || 'ROUTINE'}
                    </Text>
                    <Text style={styles.statusDot}>•</Text>
                    <Text style={styles.statusText}>{item.status}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#475569" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#050810', '#1E1B4B']} style={StyleSheet.absoluteFill} />
            
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeText}>Clinical Command,</Text>
                    <Text style={styles.docName}>Dr. Arjun Singh</Text>
                </View>
                <TouchableOpacity style={styles.profileCircle}>
                    <Ionicons name="notifications-outline" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
                <StatBox value={stats.total} label="Rounds" icon="people" />
                <StatBox value={stats.critical} label="Critical" icon="warning" color="#EF4444" active />
                <StatBox value={stats.surgeries} label="Surgeries" icon="cut" />
            </View>

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>ACTIVE PATIENT ROUNDS</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <Ionicons name="refresh" size={16} color="#6366F1" />
                </TouchableOpacity>
            </View>
            
            {loading && !refreshing ? (
                <ActivityIndicator color="#6366F1" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={patients}
                    renderItem={({ item }) => <PatientCard item={item} />}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
                />
            )}

            <TouchableOpacity 
                style={styles.fab}
                onPress={() => navigation.navigate('Prescription')}
            >
                <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.fabGradient}>
                    <Ionicons name="document-text" size={24} color="#fff" />
                    <Text style={styles.fabText}>RX</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const StatBox = ({ value, label, icon, color = '#fff', active = false }) => (
    <View style={[styles.statBox, active && styles.statActive]}>
        <View style={styles.statHeader}>
            <Ionicons name={icon} size={14} color={active ? color : '#64748B'} />
            <Text style={[styles.statVal, { color: active ? color : '#FFFFFF' }]}>{value}</Text>
        </View>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050810' },
    header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    welcomeText: { color: '#94A3B8', fontSize: 14, fontFamily: 'System' },
    docName: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: 4 },
    profileCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    
    statsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 30 },
    statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    statActive: { borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.05)' },
    statHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statVal: { fontSize: 22, fontWeight: '900' },
    statLabel: { fontSize: 10, color: '#64748B', marginTop: 6, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },
    
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 15 },
    sectionTitle: { fontSize: 11, color: '#6366F1', fontWeight: '900', letterSpacing: 2 },
    
    listContent: { paddingHorizontal: 24, paddingBottom: 100 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 18, borderRadius: 28, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    riskBar: { width: 4, height: 40, borderRadius: 2, marginRight: 18 },
    cardInfo: { flex: 1 },
    patientName: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
    roomNo: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    riskLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    statusDot: { color: '#475569', marginHorizontal: 6, fontSize: 12 },
    statusText: { fontSize: 10, color: '#64748B', fontWeight: 'bold' },
    
    fab: { position: 'absolute', right: 24, bottom: 40, width: 70, height: 70, borderRadius: 35, elevation: 15, shadowColor: '#6366F1', shadowOpacity: 0.4, shadowRadius: 20 },
    fabGradient: { flex: 1, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
    fabText: { color: '#fff', fontSize: 10, fontWeight: '900', marginTop: 2 }
});
