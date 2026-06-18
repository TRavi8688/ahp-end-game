// ============================================================
// InventoryScreen.js — Wired to /api/v1/pharmacy/inventory
// Place at: pharma-mobile-app/src/screens/InventoryScreen.js
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Modal, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { getInventory, restockMedicine, getUser } from '../services/pharmaApi';

function getRowColor(item) {
  if (item.quantity < item.reorder_level) return '#fef2f2'; // low stock — red tint
  const daysToExpiry = Math.ceil((new Date(item.expiry_date) - new Date()) / 86400000);
  if (daysToExpiry <= 30) return '#fffbeb'; // expiring soon — orange tint
  return '#fff';
}

function getBadge(item) {
  if (item.quantity < item.reorder_level) return { label: 'Low Stock', color: '#ef4444' };
  const days = Math.ceil((new Date(item.expiry_date) - new Date()) / 86400000);
  if (days <= 30) return { label: `Exp. ${days}d`, color: '#f59e0b' };
  return null;
}

export default function InventoryScreen() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [hospitalId, setHospitalId] = useState(null);

  // Restock modal
  const [restockItem, setRestockItem] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restocking, setRestocking] = useState(false);

  useEffect(() => {
    getUser().then(user => {
      if (user?.hospital_id) setHospitalId(user.hospital_id);
    });
  }, []);

  const loadPage = useCallback(async (pageNum = 1, reset = false) => {
    try {
      const data = await getInventory({ hospitalId, page: pageNum, limit: 25 });
      const newItems = data.items || data.results || data || [];
      setItems(prev => reset ? newItems : [...prev, ...newItems]);
      setHasMore(newItems.length === 25);
      setPage(pageNum);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }, [hospitalId]);

  useEffect(() => {
    if (hospitalId !== null) {
      loadPage(1, true).finally(() => setLoading(false));
    }
  }, [hospitalId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPage(1, true);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadPage(page + 1);
    setLoadingMore(false);
  };

  const handleRestock = async () => {
    const qty = parseInt(restockQty, 10);
    if (!qty || qty <= 0) {
      Alert.alert('Invalid', 'Enter a valid quantity greater than 0');
      return;
    }
    setRestocking(true);
    try {
      await restockMedicine(restockItem.id, qty);
      // Update local state
      setItems(prev => prev.map(i =>
        i.id === restockItem.id ? { ...i, quantity: i.quantity + qty } : i
      ));
      Alert.alert('Success', `Restocked ${qty} units of ${restockItem.medicine_name}`);
      setRestockItem(null);
      setRestockQty('');
    } catch (err) {
      Alert.alert('Restock Failed', err.message);
    } finally {
      setRestocking(false);
    }
  };

  const filtered = search.trim()
    ? items.filter(i => i.medicine_name?.toLowerCase().includes(search.toLowerCase()) ||
        i.batch_number?.toLowerCase().includes(search.toLowerCase()))
    : items;

  const renderItem = ({ item }) => {
    const badge = getBadge(item);
    return (
      <View style={[styles.row, { backgroundColor: getRowColor(item) }]}>
        <View style={styles.rowMain}>
          <View style={styles.rowHeader}>
            <Text style={styles.medicineName}>{item.medicine_name}</Text>
            {badge && (
              <View style={[styles.badge, { backgroundColor: badge.color }]}>
                <Text style={styles.badgeText}>{badge.label}</Text>
              </View>
            )}
          </View>
          <Text style={styles.rowMeta}>
            Batch: {item.batch_number}  ·  Exp: {item.expiry_date?.slice(0, 10)}
          </Text>
          <View style={styles.rowStats}>
            <Text style={styles.statText}>Qty: <Text style={{ fontWeight: '700', color: item.quantity < item.reorder_level ? '#ef4444' : '#0f172a' }}>{item.quantity}</Text></Text>
            <Text style={styles.statText}>Reorder: {item.reorder_level}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.restockBtn} onPress={() => setRestockItem(item)}>
          <Text style={styles.restockBtnText}>Restock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#0ea5e9" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search medicine or batch..."
          placeholderTextColor="#94a3b8"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color="#0ea5e9" /> : null}
        ListEmptyComponent={<Text style={styles.empty}>No medicines found</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* Restock Modal */}
      <Modal visible={!!restockItem} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Restock Medicine</Text>
            <Text style={styles.modalMedicine}>{restockItem?.medicine_name}</Text>
            <Text style={styles.modalMeta}>Current stock: {restockItem?.quantity}  ·  Reorder level: {restockItem?.reorder_level}</Text>
            <Text style={styles.modalLabel}>Quantity to add</Text>
            <TextInput
              style={styles.modalInput}
              value={restockQty}
              onChangeText={setRestockQty}
              keyboardType="number-pad"
              placeholder="e.g. 100"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setRestockItem(null); setRestockQty(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, restocking && styles.btnDisabled]} onPress={handleRestock} disabled={restocking}>
                {restocking ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 12, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0f172a' },
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  rowMain: { flex: 1 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  medicineName: { fontSize: 15, fontWeight: '700', color: '#0f172a', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rowMeta: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  rowStats: { flexDirection: 'row', gap: 16 },
  statText: { fontSize: 13, color: '#475569' },
  restockBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 12 },
  restockBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  modalMedicine: { fontSize: 16, color: '#0ea5e9', fontWeight: '600', marginBottom: 4 },
  modalMeta: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  modalInput: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 18, textAlign: 'center', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: '#0ea5e9', padding: 14, borderRadius: 10, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});
