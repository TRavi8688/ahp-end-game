import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../theme';
import ApiService from '../utils/ApiService';

export default function CEODashboardScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        revenue: "₹0",
        occupancy: "0%",
        wait_time: "0m",
        risk_alerts: 0
    });

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            // In Production, this calls the AnalyticsService via the Read-Replica
            // const data = await ApiService.get('/analytics/daily-snapshot');
            // setMetrics(data);
            
            // Simulation for demo readiness
            setTimeout(() => {
                setMetrics({
                    revenue: "₹4.2L",
                    occupancy: "82%",
                    wait_time: "14m",
                    risk_alerts: 3
                });
                setLoading(false);
            }, 1500);
        } catch (e) {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMetrics(); }, []);

    const MetricCard = ({ title, value, icon, color, subtitle }) => (
        <View style={styles.metricCard}>
            <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View>
                <Text style={styles.metricValue}>{value}</Text>
                <Text style={styles.metricTitle}>{title}</Text>
                {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#050810', '#1E1B4B']} style={StyleSheet.absoluteFill} />
            
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>COMMAND CENTER</Text>
                    <Text style={styles.hospitalName}>City General Hospital</Text>
                </View>
                <TouchableOpacity onPress={fetchMetrics}>
                    <Ionicons name="refresh" size={24} color="#6366F1" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchMetrics} tintColor="#6366F1" />}
            >
                <View style={styles.grid}>
                    <MetricCard 
                        title="TODAY REVENUE" 
                        value={metrics.revenue} 
                        icon="cash-outline" 
                        color="#10B981" 
                        subtitle="+12% vs yesterday"
                    />
                    <MetricCard 
                        title="BED OCCUPANCY" 
                        value={metrics.occupancy} 
                        icon="bed-outline" 
                        color="#6366F1" 
                        subtitle="14 units available"
                    />
                    <MetricCard 
                        title="AVG WAIT TIME" 
                        value={metrics.wait_time} 
                        icon="time-outline" 
                        color="#F59E0B" 
                        subtitle="Target: <15m"
                    />
                    <MetricCard 
                        title="RISK ALERTS" 
                        value={metrics.risk_alerts} 
                        icon="warning-outline" 
                        color="#EF4444" 
                        subtitle="Action required"
                    />
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>CRITICAL RISK MONITOR</Text>
                    <TouchableOpacity>
                        <Text style={styles.viewAll}>VIEW ALL</Text>
                    </TouchableOpacity>
                </View>

                {/* Simulated Risk Feed */}
                <View style={styles.riskCard}>
                    <View style={styles.riskHeader}>
                        <View style={styles.riskIndicator} />
                        <Text style={styles.riskType}>SEPSIS_PREDICTION</Text>
                        <Text style={styles.riskTime}>2m ago</Text>
                    </View>
                    <Text style={styles.riskPatient}>Patient: Rahul Sharma (H-9821)</Text>
                    <Text style={styles.riskDesc}>Rising pulse trend (118 BPM) + Abnormal WBC count.</Text>
                    <TouchableOpacity style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>ESCALATE TO ICU</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050810' },
    header: { 
        paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'
    },
    greeting: { color: '#6366F1', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
    hospitalName: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
    scrollContent: { padding: 24 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 30 },
    metricCard: { 
        width: '47%', backgroundColor: 'rgba(255,255,255,0.03)', 
        padding: 16, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    metricValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    metricTitle: { color: '#94A3B8', fontSize: 10, fontWeight: 'bold', marginTop: 4 },
    metricSubtitle: { color: '#475569', fontSize: 9, marginTop: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    sectionTitle: { color: '#6366F1', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    viewAll: { color: '#94A3B8', fontSize: 10, fontWeight: 'bold' },
    riskCard: { 
        backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 24, padding: 20,
        borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)'
    },
    riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    riskIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
    riskType: { color: '#EF4444', fontSize: 10, fontWeight: 'bold' },
    riskTime: { color: '#475569', fontSize: 10, marginLeft: 'auto' },
    riskPatient: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    riskDesc: { color: '#94A3B8', fontSize: 12, marginTop: 4, lineHeight: 18 },
    actionBtn: { 
        marginTop: 15, backgroundColor: 'rgba(239, 68, 68, 0.2)', 
        height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center'
    },
    actionBtnText: { color: '#EF4444', fontSize: 11, fontWeight: 'bold' }
});
