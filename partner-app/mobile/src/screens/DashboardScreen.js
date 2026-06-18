// ============================================================
// DashboardScreen.js — Wired to /api/v1/pharmacy/dashboard
// Place at: pharma-mobile-app/src/screens/DashboardScreen.js
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { getDashboard, getWeeklyDispensingVolume } from '../services/pharmaApi';

const STAT_CARDS = [
  { key: 'total_medicines', label: 'Total Medicines', icon: '💊', color: '#0ea5e9' },
  { key: 'low_stock_count', label: 'Low Stock', icon: '⚠️', color: '#f59e0b' },
  { key: 'today_prescriptions', label: "Today's Rx", icon: '📋', color: '#10b981' },
  { key: 'pending_orders', label: 'Pending Orders', icon: '📦', color: '#8b5cf6' },
];

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [dashData, weekly] = await Promise.all([
        getDashboard(),
        getWeeklyDispensingVolume().catch(() => []),
      ]);
      setStats(dashData);
      setWeeklyData(weekly?.data || weekly || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); loadData().finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Bar chart max for scaling
  const maxVal = weeklyData.length ? Math.max(...weeklyData.map(d => d.count || 0), 1) : 1;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Good {getGreeting()} 👋</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      </View>

      {/* Stat Cards */}
      <View style={styles.cardsGrid}>
        {STAT_CARDS.map(card => (
          <View key={card.key} style={[styles.card, { borderLeftColor: card.color }]}>
            <Text style={styles.cardIcon}>{card.icon}</Text>
            <Text style={[styles.cardValue, { color: card.color }]}>
              {stats?.[card.key] ?? '—'}
            </Text>
            <Text style={styles.cardLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      {/* Weekly Dispensing Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Weekly Dispensing Volume</Text>
        {weeklyData.length > 0 ? (
          <View style={styles.barChart}>
            {weeklyData.map((day, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barValue}>{day.count}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${Math.round((day.count / maxVal) * 100)}%`, backgroundColor: '#0ea5e9' },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{day.day || day.date?.slice(-2)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noData}>No dispensing data available</Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          {[
            { label: 'Inventory', icon: '🏪', screen: 'Inventory' },
            { label: 'Prescriptions', icon: '📋', screen: 'Prescriptions' },
            { label: 'Scan QR', icon: '📷', screen: 'QRScanner' },
          ].map(action => (
            <TouchableOpacity
              key={action.screen}
              style={styles.actionBtn}
              onPress={() => navigation.navigate(action.screen)}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#64748b' },
  errorIcon: { fontSize: 40 },
  errorText: { color: '#ef4444', textAlign: 'center', marginTop: 8, marginBottom: 16 },
  retryBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  header: { padding: 20, paddingBottom: 4 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  date: { fontSize: 13, color: '#64748b', marginTop: 2 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12 },
  card: {
    width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardIcon: { fontSize: 24, marginBottom: 8 },
  cardValue: { fontSize: 28, fontWeight: '800' },
  cardLabel: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '500' },
  chartSection: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  barChart: { flexDirection: 'row', height: 140, alignItems: 'flex-end', justifyContent: 'space-around' },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 10, color: '#64748b', marginBottom: 4 },
  barTrack: { width: 28, height: 100, justifyContent: 'flex-end', backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 10, color: '#64748b', marginTop: 4 },
  noData: { color: '#94a3b8', textAlign: 'center', paddingVertical: 24 },
  quickActions: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around' },
  actionBtn: { alignItems: 'center', padding: 12 },
  actionIcon: { fontSize: 32 },
  actionLabel: { fontSize: 12, color: '#374151', marginTop: 6, fontWeight: '600' },
});
