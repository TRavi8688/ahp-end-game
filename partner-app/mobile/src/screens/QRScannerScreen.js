// ============================================================
// QRScannerScreen.js — Scan medicine barcode/QR
// Place at: pharma-mobile-app/src/screens/QRScannerScreen.js
//
// Requires: expo-barcode-scanner (add to package.json)
//   npx expo install expo-barcode-scanner
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { scanBarcode } from '../services/pharmaApi';

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const cooldown = useRef(false);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  const handleScan = async ({ type, data }) => {
    if (cooldown.current || !scanning) return;
    cooldown.current = true;
    setScanning(false);
    setLoading(true);

    try {
      const medicine = await scanBarcode(data);
      setResult(medicine);
    } catch (err) {
      Alert.alert('Scan Failed', err.message, [
        { text: 'Try Again', onPress: resetScan },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => { cooldown.current = false; }, 2000);
    }
  };

  const resetScan = () => {
    setResult(null);
    setScanning(true);
  };

  if (hasPermission === null) {
    return <View style={styles.centered}><ActivityIndicator color="#0ea5e9" /></View>;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centered}>
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.permText}>Camera permission denied</Text>
        <Text style={styles.permSub}>Please enable camera access in your device settings to use the QR scanner.</Text>
      </View>
    );
  }

  const daysToExpiry = result?.expiry_date
    ? Math.ceil((new Date(result.expiry_date) - new Date()) / 86400000)
    : null;

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanning ? handleScan : undefined}
        style={StyleSheet.absoluteFillObject}
        barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr, BarCodeScanner.Constants.BarCodeType.code128, BarCodeScanner.Constants.BarCodeType.ean13]}
      />

      {/* Overlay frame */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middle}>
          <View style={styles.sideOverlay} />
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay}>
          <Text style={styles.hint}>
            {loading ? '🔍 Looking up medicine...' : 'Scan a medicine QR code or barcode'}
          </Text>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Result Modal */}
      <Modal visible={!!result} transparent animationType="slide" onRequestClose={resetScan}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>💊 Medicine Details</Text>

              <InfoRow label="Name" value={result?.medicine_name} bold />
              <InfoRow label="Batch" value={result?.batch_number} />
              <InfoRow label="Manufacturer" value={result?.manufacturer} />
              <InfoRow
                label="Expiry"
                value={result?.expiry_date?.slice(0, 10)}
                valueColor={daysToExpiry !== null && daysToExpiry <= 30 ? '#f59e0b' : undefined}
                extra={daysToExpiry !== null ? ` (${daysToExpiry}d)` : ''}
              />

              <View style={styles.divider} />

              <InfoRow
                label="Current Stock"
                value={String(result?.quantity ?? '—')}
                valueColor={result?.quantity < result?.reorder_level ? '#ef4444' : '#10b981'}
                bold
              />
              <InfoRow label="Reorder Level" value={String(result?.reorder_level ?? '—')} />

              {result?.quantity < result?.reorder_level && (
                <View style={styles.alertBanner}>
                  <Text style={styles.alertText}>⚠️ Stock below reorder level — replenishment needed</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.scanAgainBtn} onPress={resetScan}>
              <Text style={styles.scanAgainText}>📷 Scan Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, bold, valueColor, extra }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, bold && styles.infoBold, valueColor && { color: valueColor }]}>
        {value ?? '—'}{extra || ''}
      </Text>
    </View>
  );
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.6)';
const FRAME = 240;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#0f172a' },
  icon: { fontSize: 48, marginBottom: 16 },
  permText: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  permSub: { color: '#94a3b8', textAlign: 'center', marginTop: 8 },
  overlay: { flex: 1 },
  topOverlay: { flex: 1, backgroundColor: OVERLAY_COLOR },
  middle: { flexDirection: 'row', height: FRAME },
  sideOverlay: { flex: 1, backgroundColor: OVERLAY_COLOR },
  scanFrame: { width: FRAME, height: FRAME, borderRadius: 4, overflow: 'visible' },
  bottomOverlay: { flex: 1, backgroundColor: OVERLAY_COLOR, alignItems: 'center', paddingTop: 24 },
  hint: { color: '#fff', fontSize: 14, fontWeight: '500' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#0ea5e9', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 14, color: '#64748b' },
  infoValue: { fontSize: 14, color: '#0f172a' },
  infoBold: { fontWeight: '700', fontSize: 16 },
  divider: { height: 12 },
  alertBanner: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 12, marginTop: 12 },
  alertText: { color: '#d97706', fontSize: 13, fontWeight: '600' },
  scanAgainBtn: { backgroundColor: '#0ea5e9', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  scanAgainText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
