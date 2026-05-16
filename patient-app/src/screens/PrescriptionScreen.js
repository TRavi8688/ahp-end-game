import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../utils/ApiService';
import { Theme, GlobalStyles } from '../theme';
import { HapticUtils } from '../utils/haptics';

export default function PrescriptionScreen({ navigation }) {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPrescriptions = async () => {
        try {
            const data = await ApiService.getPrescriptions();
            setPrescriptions(data);
        } catch (error) {
            console.error('Fetch prescriptions error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchPrescriptions();
    };

    const renderItem = ({ item }) => {
        const isFulfilled = item.status === 'fulfilled';
        const color = isFulfilled ? Theme.colors.success : Theme.colors.primary;

        return (
            <TouchableOpacity 
                style={[styles.card, GlobalStyles.glass]} 
                onPress={() => {
                    HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Light);
                    navigation.navigate('PrescriptionDetail', { prescription: item });
                }}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
                        <MaterialCommunityIcons name="pill" size={24} color={color} />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                        <Text style={styles.diagnosis} numberOfLines={1}>{item.diagnosis || 'General Consultation'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
                        <Text style={[styles.statusText, { color }]}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>
                
                <View style={styles.medicationPreview}>
                    <Text style={styles.previewText}>
                        {item.medications?.length || 0} Medications Prescribed
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#475569" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={GlobalStyles.screen}>
            <LinearGradient colors={['#0F172A', '#050810']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={[GlobalStyles.heading, styles.headerTitle]}>PRESCRIPTIONS</Text>
                <View style={{ width: 24 }} />
            </LinearGradient>

            <FlatList
                data={prescriptions}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.emptyBox}>
                            <MaterialCommunityIcons name="medical-bag" size={60} color="#1E293B" />
                            <Text style={styles.emptyText}>No digital prescriptions found.</Text>
                        </View>
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 18, letterSpacing: 4 },
    backBtn: { padding: 4 },
    listContent: { padding: 20 },
    card: { padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
    iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    headerInfo: { flex: 1 },
    date: { color: '#64748B', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    diagnosis: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
    statusBadge: { px: 10, py: 4, borderRadius: 8 },
    statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    medicationPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', pt: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    previewText: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
    emptyBox: { alignItems: 'center', py: 100 },
    emptyText: { color: '#475569', marginTop: 20, fontSize: 14 }
});
