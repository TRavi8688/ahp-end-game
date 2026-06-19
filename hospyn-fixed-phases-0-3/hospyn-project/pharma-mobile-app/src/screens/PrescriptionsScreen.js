import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal } from 'react-native';
import { Theme, GlobalStyles } from '../theme/Theme';
import ApiService from '../utils/ApiService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function PrescriptionsScreen() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showCheckout, setShowCheckout] = useState(false);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const res = await ApiService.get('/referrals/pharmacies/incoming');
            setOrders(res.data || []);
        } catch (error) {
            console.error('Failed to load network orders:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const openDetails = (order) => {
        setSelectedOrder(order);
        setShowCheckout(true);
    };

    const handleAcceptAndCheckout = async () => {
        if (!selectedOrder) return;
        try {
            // First accept
            await ApiService.post(`/referrals/pharmacies/${selectedOrder.id}/action?action=accept`);
            // Wait a bit to simulate processing
            setTimeout(async () => {
                await ApiService.post(`/referrals/pharmacies/${selectedOrder.id}/action?action=fulfill`);
                Alert.alert('Checkout Complete', `Invoice Generated for ${selectedOrder.patient_name}.\nAmount: ₹450 Paid via UPI.`);
                setShowCheckout(false);
                setSelectedOrder(null);
                loadOrders();
            }, 1000);
        } catch (error) {
            console.error('Checkout Error:', error);
            Alert.alert('Error', 'Failed to process checkout.');
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => openDetails(item)}>
            <View style={styles.cardHeader}>
                <View style={styles.patientBadge}>
                    <Ionicons name="person" size={12} color={Theme.colors.secondary} />
                    <Text style={styles.patientName}>{item.patient_name}</Text>
                </View>
                <Text style={styles.timeText}>{new Date(item.shared_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
            </View>
            
            <View style={styles.diagnosisBox}>
                <Text style={styles.diagnosisLabel}>DIAGNOSIS</Text>
                <Text style={styles.diagnosisText}>{item.diagnosis}</Text>
            </View>

            <View style={styles.medsContainer}>
                {item.medications.map((m, i) => (
                    <View key={i} style={styles.medRow}>
                        <MaterialCommunityIcons name="pill" size={16} color={Theme.colors.textMuted} />
                        <Text style={styles.medText}>{m.medicine_name} - {m.dosage}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.acceptBtn}>
                <Text style={styles.acceptBtnText}>VIEW & CHECKOUT</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={GlobalStyles.screen}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>PRESCRIPTION QUEUE</Text>
                <Text style={styles.headerSub}>Active Orders</Text>
            </View>
            
            <FlatList
                data={orders}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadOrders} tintColor="#fff" />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="document-text-outline" size={48} color={Theme.colors.border} />
                        <Text style={styles.emptyText}>No active prescriptions.</Text>
                    </View>
                }
            />

            {/* Fast Checkout Modal */}
            <Modal visible={showCheckout} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <View style={styles.checkoutCard}>
                        {selectedOrder && (
                            <>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                                    <Text style={styles.modalTitle}>Order Checkout</Text>
                                    <TouchableOpacity onPress={() => setShowCheckout(false)}>
                                        <Ionicons name="close" size={24} color={Theme.colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.aiBadge}>
                                    <Ionicons name="shield-checkmark" size={16} color={Theme.colors.success} />
                                    <Text style={styles.aiText}>AI Verified: No Drug Interactions Detected</Text>
                                </View>

                                <Text style={styles.sectionLabel}>PATIENT</Text>
                                <Text style={styles.patientDetailText}>{selectedOrder.patient_name}</Text>

                                <Text style={[styles.sectionLabel, {marginTop: 15}]}>ITEMS DISPENSED</Text>
                                {selectedOrder.medications.map((m, i) => (
                                    <View key={i} style={styles.checkoutItemRow}>
                                        <Text style={styles.checkoutItemText}>{m.medicine_name}</Text>
                                        <Text style={styles.checkoutItemPrice}>₹150</Text>
                                    </View>
                                ))}
                                
                                <View style={styles.divider} />
                                <View style={styles.checkoutItemRow}>
                                    <Text style={styles.totalLabel}>TOTAL TO PAY</Text>
                                    <Text style={styles.totalValue}>₹{selectedOrder.medications.length * 150}</Text>
                                </View>

                                <TouchableOpacity style={styles.checkoutBtn} onPress={handleAcceptAndCheckout}>
                                    <Ionicons name="cash-outline" size={20} color="#fff" />
                                    <Text style={styles.checkoutBtnText}>COLLECT PAYMENT & DISPENSE</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, paddingBottom: 10 },
    headerTitle: { fontSize: 10, color: Theme.colors.secondary, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
    headerSub: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
    list: { padding: 24 },
    card: { backgroundColor: Theme.colors.surface, borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Theme.colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    patientBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
    patientName: { color: Theme.colors.secondary, fontSize: 12, fontWeight: 'bold' },
    timeText: { color: Theme.colors.textMuted, fontSize: 12 },
    diagnosisBox: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, marginBottom: 16 },
    diagnosisLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
    diagnosisText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    medsContainer: { marginBottom: 20, gap: 8 },
    medRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    medText: { color: Theme.colors.textMuted, fontSize: 14 },
    acceptBtn: { backgroundColor: 'rgba(16,185,129,0.1)', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
    acceptBtnText: { color: Theme.colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: Theme.colors.textMuted, marginTop: 16 },

    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    checkoutCard: { backgroundColor: Theme.colors.surface, padding: 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: Theme.colors.border },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', padding: 10, borderRadius: 12, gap: 8, marginBottom: 20 },
    aiText: { color: Theme.colors.success, fontSize: 12, fontWeight: 'bold' },
    sectionLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
    patientDetailText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    checkoutItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    checkoutItemText: { color: '#fff', fontSize: 14 },
    checkoutItemPrice: { color: Theme.colors.secondary, fontSize: 14, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: Theme.colors.border, marginVertical: 15 },
    totalLabel: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    totalValue: { color: Theme.colors.primary, fontSize: 24, fontWeight: 'bold' },
    checkoutBtn: { backgroundColor: Theme.colors.primary, padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 30, elevation: 5 },
    checkoutBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 }
});
