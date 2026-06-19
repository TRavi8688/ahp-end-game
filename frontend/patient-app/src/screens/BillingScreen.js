/**
 * BillingScreen.js
 * Phase 3 Fix: Patient App — Billing screen with UPI QR code
 *
 * APPLY TO: patient-app/src/screens/BillingScreen.js  (create or replace)
 *
 * Install dependencies:
 *   npm install react-native-qrcode-svg
 *   npx expo install expo-sharing
 *
 * Register in navigator:
 *   <Stack.Screen name="Billing" component={BillingScreen} />
 *   <Stack.Screen name="BillingDetail" component={BillingDetailScreen} />
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Share,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    paid: { bg: "#d1fae5", text: "#065f46", label: "PAID" },
    pending: { bg: "#fef3c7", text: "#92400e", label: "PENDING" },
    cancelled: { bg: "#f3f4f6", text: "#6b7280", label: "CANCELLED" },
  };
  const s = map[status] || map.pending;
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: "700" }}>{s.label}</Text>
    </View>
  );
}

// ── Invoice list screen ────────────────────────────────────────────────────
export default function BillingScreen() {
  const navigation = useNavigation();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [patientId, setPatientId] = useState(null);

  const fetchInvoices = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem("access_token");
      const pid = patientId || await AsyncStorage.getItem("patient_id");
      if (!pid) throw new Error("Patient ID not found. Please re-login.");

      const res = await fetch(
        `${API_BASE}/api/v1/billing/patient/${pid}/invoices?limit=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to load invoices");
      const data = await res.json();
      setInvoices(data.invoices || []);
      setPatientId(pid);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => { fetchInvoices(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchInvoices(true); };

  const renderInvoice = ({ item }) => (
    <TouchableOpacity
      style={styles.invoiceCard}
      onPress={() => navigation.navigate("BillingDetail", { invoiceId: item.id })}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
        <Text style={styles.hospitalName}>{item.hospital_name}</Text>
        <Text style={styles.invoiceDate}>{String(item.created_at || "").slice(0, 10)}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={styles.amount}>₹{parseFloat(item.total_amount || 0).toFixed(2)}</Text>
        <StatusBadge status={item.status} />
      </View>
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#1e3a5f" />
      <Text style={styles.loadingText}>Loading bills...</Text>
    </View>
  );

  if (error) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>⚠️ {error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => fetchInvoices()}>
        <Text style={styles.retryBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <FlatList
        data={invoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <Text style={styles.screenTitle}>My Bills</Text>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>🧾</Text>
            <Text style={{ color: "#9ca3af", marginTop: 8 }}>No bills found</Text>
          </View>
        }
      />
    </View>
  );
}

// ── Invoice detail screen (QR code) ───────────────────────────────────────
export function BillingDetailScreen({ route }) {
  const { invoiceId } = route.params;
  const navigation = useNavigation();
  const [invoice, setInvoice] = useState(null);
  const [upiUrl, setUpiUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        const [invRes, upiRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/billing/invoice/${invoiceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/v1/billing/invoice/${invoiceId}/upi-url`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const inv = await invRes.json();
        const upi = upiRes.ok ? await upiRes.json() : null;
        setInvoice(inv);
        setUpiUrl(upi?.upi_url || null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [invoiceId]);

  const handleShare = async () => {
    if (!upiUrl) return;
    try {
      await Share.share({
        message: `Pay ₹${parseFloat(invoice?.total_amount || 0).toFixed(2)} to ${invoice?.hospital_name}\nUPI Link: ${upiUrl}`,
        title: "Hospyn Payment",
      });
    } catch (e) {
      console.error("Share error:", e);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#1e3a5f" />
    </View>
  );

  if (error || !invoice) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>⚠️ {error || "Invoice not found"}</Text>
    </View>
  );

  const isPaid = invoice.status === "paid";

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <View style={{ padding: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
              {invoice.invoice_number}
            </Text>
            <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
              {invoice.hospital_name}
            </Text>
          </View>
          <StatusBadge status={invoice.status} />
        </View>

        {/* Patient info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patient</Text>
            <Text style={styles.infoValue}>{invoice.patient_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{String(invoice.created_at || "").slice(0, 10)}</Text>
          </View>
          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 8, paddingTop: 8 }]}>
            <Text style={[styles.infoLabel, { fontWeight: "700", color: "#111827" }]}>Total Amount</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#1e3a5f" }}>
              ₹{parseFloat(invoice.total_amount || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* QR Code section */}
        {!isPaid && upiUrl && (
          <View style={[styles.card, { alignItems: "center", marginTop: 16 }]}>
            <Text style={styles.cardTitle}>Scan to Pay</Text>
            <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 16, textAlign: "center" }}>
              Open GPay, PhonePe, or any UPI app and scan this code
            </Text>
            <QRCode value={upiUrl} size={200} />
            <Text style={{ marginTop: 12, color: "#374151", fontWeight: "700", fontSize: 16 }}>
              ₹{parseFloat(invoice.total_amount || 0).toFixed(2)}
            </Text>
            <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>
              Pay to: {invoice.upi_vpa}
            </Text>
            <TouchableOpacity
              style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 6 }}
              onPress={handleShare}
            >
              <Text style={{ color: "#1e3a5f", fontSize: 13, fontWeight: "600" }}>
                📤 Share UPI Link
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isPaid && !upiUrl && (
          <View style={[styles.card, { marginTop: 16, backgroundColor: "#fef3c7" }]}>
            <Text style={{ color: "#92400e", fontSize: 13, textAlign: "center" }}>
              ⚠️ Hospital hasn't set up UPI payments yet.{"\n"}
              Please pay at the reception counter.
            </Text>
          </View>
        )}

        {isPaid && (
          <View style={[styles.card, { marginTop: 16, backgroundColor: "#d1fae5", borderColor: "#a7f3d0", borderWidth: 1 }]}>
            <Text style={{ color: "#065f46", fontWeight: "700", fontSize: 15, marginBottom: 8 }}>
              ✓ Payment Confirmed
            </Text>
            <Text style={{ color: "#065f46", fontSize: 12 }}>
              UPI Ref: {invoice.upi_transaction_ref}
            </Text>
            <Text style={{ color: "#065f46", fontSize: 12, marginTop: 2 }}>
              Paid: {String(invoice.paid_at || "").slice(0, 16).replace("T", " ")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  loadingText: { marginTop: 12, color: "#6b7280", fontSize: 14 },
  errorText: { color: "#dc2626", fontSize: 14, textAlign: "center" },
  retryBtn: { marginTop: 12, backgroundColor: "#1e3a5f", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: "white", fontWeight: "600" },
  screenTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 16 },
  invoiceCard: {
    backgroundColor: "white", borderRadius: 10, padding: 16,
    marginBottom: 10, flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  invoiceNumber: { fontSize: 14, fontWeight: "700", color: "#111827" },
  hospitalName: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  invoiceDate: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "800", color: "#1e3a5f" },
  card: {
    backgroundColor: "white", borderRadius: 10, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 10 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  infoLabel: { color: "#9ca3af", fontSize: 13 },
  infoValue: { color: "#111827", fontSize: 13, fontWeight: "500" },
});
