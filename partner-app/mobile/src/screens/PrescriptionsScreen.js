// ============================================================
// PrescriptionsScreen.js — Pending Rx to dispense
// Place at: pharma-mobile-app/src/screens/PrescriptionsScreen.js
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { getPendingPrescriptions, dispensePrescription } from '../services/pharmaApi';

export default function PrescriptionsScreen() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dispensing, setDispensing] = useState(null); // id being dispensed

  const load = useCallback(async () => {
    try {
      const data = await getPendingPrescriptions();
      setPrescriptions(data.items || data.results || data || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDispense = (rx) => {
    Alert.alert(
      'Confirm Dispense',
      `Mark prescription #${rx.id} for ${rx.patient_name} as dispensed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dispense', style: 'default',
          onPress: async () => {
            setDispensing(rx.id);
            try {
              await dispensePrescription(rx.id);
              setPrescriptions(prev => prev.filter(p => p.id !== rx.id));
            } catch (err) {
              Alert.alert('Failed', err.message);
            } finally {
              setDispensing(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.rxId}>Rx #{item.id}</Text>
          <Text style={styles.patientName}>{item.patient_name}</Text>
          <Text style={styles.meta}>Doctor: {item.doctor_name}</Text>
          <Text style={styles.meta}>Time: {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Pending</Text>
        </View>
      </View>

      {/* Medicines list */}
      <View style={styles.medicines}>
        {(item.medications || item.medicines || []).map((med, i) => (
          <View key={i} style={styles.medRow}>
            <Text style={styles.medDot}>•</Text>
            <Text style={styles.medText}>{med.name} — {med.dose} {med.frequency}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.dispenseBtn, dispensing === item.id && styles.btnDisabled]}
        onPress={() => handleDispense(item)}
        disabled={dispensing === item.id}
      >
        {dispensing === item.id
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.dispenseBtnText}>✓ Mark as Dispensed</Text>
        }
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#0ea5e9" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pending Prescriptions</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{prescriptions.length}</Text>
        </View>
      </View>

      <FlatList
        data={prescriptions}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyText}>All prescriptions dispensed!</Text>
          </View>
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1 },
  countBadge: { backgroundColor: '#ef4444', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  rxId: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginBottom: 2 },
  patientName: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  meta: { fontSize: 13, color: '#64748b' },
  statusBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#d97706', fontSize: 12, fontWeight: '700' },
  medicines: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 14 },
  medRow: { flexDirection: 'row', marginBottom: 4 },
  medDot: { color: '#0ea5e9', marginRight: 6, fontWeight: '700' },
  medText: { fontSize: 14, color: '#374151', flex: 1 },
  dispenseBtn: { backgroundColor: '#10b981', borderRadius: 10, padding: 14, alignItems: 'center' },
  dispenseBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
});
