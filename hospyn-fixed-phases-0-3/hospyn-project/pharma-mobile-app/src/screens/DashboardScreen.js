import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Theme, GlobalStyles } from '../theme/Theme';
import ApiService from '../utils/ApiService';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function DashboardScreen({ navigation }) {
    const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, todaySales: '₹0' });
    const [orders, setOrders] = useState([]);
    const [hospitalId, setHospitalId] = useState('');
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const meRes = await ApiService.get('/auth/me');
            if (meRes.data && meRes.data.hospyn_id) setHospitalId(meRes.data.hospyn_id);

            const statsRes = await ApiService.get('/pharmacy/stats');
            setStats(statsRes.data);

            const ordersRes = await ApiService.get('/referrals/pharmacies/incoming');
            // Format orders from referral model if needed
            setOrders(ordersRes.data || []);
        } catch (error) {
            console.error('Dashboard load error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const newPrescription = orders.length > 0 ? orders[0] : null;

    return (
        <View style={GlobalStyles.screen}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>HOSPYN PHARMA PARTNER</Text>
                    <Text style={styles.headerSub}>Dashboard</Text>
                </View>
                <View style={styles.profileBadge}>
                    <Ionicons name="business" size={16} color={Theme.colors.secondary} />
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#fff" />}
            >
                {/* 1. Live Alert Bar (Top) */}
                {newPrescription ? (
                    <TouchableOpacity style={styles.alertBar} onPress={() => navigation.navigate('Prescriptions')}>
                        <View style={styles.alertIconWrapper}>
                            <Ionicons name="notifications" size={18} color="#fff" />
                        </View>
                        <View style={styles.alertContent}>
                            <Text style={styles.alertTitle}>New Prescription Alert!</Text>
                            <Text style={styles.alertText}>{newPrescription.patient_name} shared a prescription.</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                ) : null}

                {/* 2. Universal Receiving QR */}
                <View style={styles.qrCard}>
                    <View style={styles.qrTextCol}>
                        <Text style={styles.qrTitle}>HOSPYN RECEIVING QR</Text>
                        <Text style={styles.qrDesc}>Display this at your counter. Patients can scan it to instantly beam their prescription to your system.</Text>
                    </View>
                    <View style={styles.qrCodeCol}>
                        <View style={styles.qrWrapper}>
                            {hospitalId ? <QRCode value={hospitalId} size={90} /> : <Text style={{color:'#ccc'}}>...</Text>}
                        </View>
                        <Text style={styles.idText}>ID: {hospitalId}</Text>
                    </View>
                </View>

                {/* 3. Quick Metrics Strip */}
                <Text style={styles.sectionTitle}>TODAY'S SNAPSHOT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricsScroll}>
                    <View style={[styles.metricBox, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                        <Text style={styles.metricLabel}>REVENUE</Text>
                        <Text style={[styles.metricValue, { color: Theme.colors.secondary }]}>{stats.todaySales}</Text>
                    </View>
                    <View style={[styles.metricBox, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                        <Text style={styles.metricLabel}>TOTAL SKUS</Text>
                        <Text style={[styles.metricValue, { color: Theme.colors.primary }]}>{stats.totalItems}</Text>
                    </View>
                    <View style={[styles.metricBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                        <Text style={styles.metricLabel}>LOW STOCK</Text>
                        <Text style={[styles.metricValue, { color: Theme.colors.danger }]}>{stats.lowStock}</Text>
                    </View>
                </ScrollView>

                {/* 4. Live Prescription Queue */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>LIVE QUEUE ({orders.length})</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Prescriptions')}>
                        <Text style={styles.viewAllText}>View All</Text>
                    </TouchableOpacity>
                </View>
                
                {orders.slice(0, 3).map((item, idx) => (
                    <TouchableOpacity key={idx} style={styles.orderCard} onPress={() => navigation.navigate('Prescriptions')}>
                        <View style={styles.orderHeader}>
                            <View style={styles.patientBadge}>
                                <Ionicons name="person" size={12} color={Theme.colors.secondary} />
                                <Text style={styles.patientName}>{item.patient_name}</Text>
                            </View>
                            <View style={styles.statusBadge}>
                                <View style={styles.dot} />
                                <Text style={styles.statusText}>PENDING</Text>
                            </View>
                        </View>
                        <Text style={styles.diagnosisText}>{item.diagnosis}</Text>
                        <Text style={styles.medCountText}>{item.medications.length} medicines requested</Text>
                    </TouchableOpacity>
                ))}
                
                {orders.length === 0 && (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No active prescriptions in the queue.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 10, color: Theme.colors.secondary, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
    headerSub: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
    profileBadge: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Theme.colors.border },
    scroll: { padding: 24, paddingBottom: 40 },
    
    alertBar: { backgroundColor: Theme.colors.secondary, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    alertIconWrapper: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10, marginRight: 15 },
    alertContent: { flex: 1 },
    alertTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    alertText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
    
    qrCard: { backgroundColor: Theme.colors.surface, borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Theme.colors.border, marginBottom: 30 },
    qrTextCol: { flex: 1, paddingRight: 15 },
    qrTitle: { color: Theme.colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
    qrDesc: { color: Theme.colors.textMuted, fontSize: 11, lineHeight: 18 },
    qrCodeCol: { alignItems: 'center' },
    qrWrapper: { padding: 8, backgroundColor: '#fff', borderRadius: 12 },
    idText: { color: Theme.colors.textMuted, fontSize: 9, marginTop: 8, letterSpacing: 1 },

    metricsScroll: { flexDirection: 'row', marginBottom: 30, overflow: 'visible' },
    metricBox: { padding: 16, borderRadius: 16, marginRight: 12, minWidth: 120, borderWidth: 1, borderColor: Theme.colors.border },
    metricLabel: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
    metricValue: { fontSize: 24, fontWeight: 'bold' },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: 'bold', letterSpacing: 2 },
    viewAllText: { color: Theme.colors.secondary, fontSize: 12, fontWeight: 'bold' },
    
    orderCard: { backgroundColor: Theme.colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Theme.colors.border, marginBottom: 12 },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    patientBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    patientName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Theme.colors.warning },
    statusText: { color: Theme.colors.warning, fontSize: 10, fontWeight: 'bold' },
    diagnosisText: { color: Theme.colors.textMuted, fontSize: 13, marginBottom: 8 },
    medCountText: { color: Theme.colors.accent, fontSize: 11, fontWeight: 'bold' },

    empty: { alignItems: 'center', paddingVertical: 20 },
    emptyText: { color: Theme.colors.textMuted, fontSize: 12 }
});
