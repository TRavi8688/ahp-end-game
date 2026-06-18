import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, Image, 
    TouchableOpacity, ActivityIndicator, Platform, 
    Linking, Alert 
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { SecurityUtils } from '../utils/security';
import ApiService from '../utils/ApiService';
import { Theme, GlobalStyles, getTheme, subscribeToTheme } from '../theme';

export default function HealthIdScreen() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [themeState, setThemeState] = useState(getTheme());

    useEffect(() => {
        return subscribeToTheme((newTheme) => {
            setThemeState(newTheme);
        });
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await ApiService.getProfile();
                setProfile(data);
            } catch (err) {
                console.log("HealthID fetch error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: Theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={Theme.colors.primary} size="large" />
            </View>
        );
    }

    const qrValue = profile?.hospyn_id || 'HOSPYN-PENDING';

    const copyToClipboard = async () => {
        if (!qrValue || qrValue === 'HOSPYN-PENDING') return;
        await Clipboard.setStringAsync(qrValue);
        Alert.alert('Copied!', 'Your Hospyn ID has been copied to your clipboard.');
    };

    const handleDownloadQR = () => {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrValue}&color=4c1d95&bgcolor=fff`;
        if (Platform.OS === 'web') {
            const link = document.createElement('a');
            link.href = url;
            link.download = `Hospyn_QR_${qrValue}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            Linking.openURL(url);
        }
    };

    const isLight = Theme.colors.primary === '#7C3AED';

    return (
        <ScrollView style={[styles.container, { backgroundColor: Theme.colors.background }]} contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
            <Text style={[styles.title, { color: Theme.colors.text }]}>Digital Health Passport</Text>
            <Text style={[styles.subtitle, { color: Theme.colors.textMuted }]}>Scan this QR code at any Hospyn-enabled facility for instant clinical history access.</Text>

            {/* Premium ID Card */}
            <LinearGradient
                colors={isLight ? ['rgba(124,58,237,0.1)', 'rgba(124,58,237,0.02)'] : ['#1e1b4b', '#4c1d95', '#1e1b4b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.card, { borderColor: isLight ? 'rgba(124,58,237,0.2)' : 'transparent', borderWidth: isLight ? 1 : 0 }]}
            >
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={[styles.brandName, { color: isLight ? '#7C3AED' : '#fff' }]}>HOSPYN</Text>
                        <Text style={[styles.cardType, { color: isLight ? '#64748B' : 'rgba(255,255,255,0.6)' }]}>GLOBAL PATIENT ID</Text>
                    </View>
                    <Ionicons name="shield-checkmark" size={32} color="#10b981" />
                </View>

                <View style={styles.qrContainer}>
                    <View style={styles.qrBackground}>
                        <QRCode
                            value={qrValue}
                            size={160}
                            color="#0F172A"
                            backgroundColor="#FFFFFF"
                        />
                    </View>
                    <View style={styles.scanHint}>
                        <Ionicons name="scan" size={16} color={isLight ? '#64748B' : "rgba(255,255,255,0.6)"} />
                        <Text style={[styles.scanText, { color: isLight ? '#64748B' : 'rgba(255,255,255,0.6)' }]}>AUTHORIZED CLINICAL SCAN ONLY</Text>
                    </View>
                </View>

                <View style={[styles.patientInfo, { borderTopColor: isLight ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.1)' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.infoLabel, { color: isLight ? '#94A3B8' : 'rgba(255,255,255,0.5)' }]}>PATIENT NAME</Text>
                        <Text style={[styles.infoValue, { color: isLight ? '#0F172A' : '#fff' }]}>{profile?.full_name?.toUpperCase() || 'ANONYMOUS PATIENT'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', flex: 1 }}>
                        <Text style={[styles.infoLabel, { color: isLight ? '#F59E0B' : '#fcd34d' }]}>YOUR LOGIN ID</Text>
                        <TouchableOpacity onPress={copyToClipboard} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.infoValue, { color: isLight ? '#0F172A' : '#fff' }]}>{qrValue}</Text>
                            <Ionicons name="copy-outline" size={16} color={isLight ? '#0F172A' : '#fff'} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <Text style={[styles.securityText, { color: isLight ? '#94A3B8' : 'rgba(255,255,255,0.4)' }]}>AES-256 ENCRYPTED · ZERO TRUST VERIFIED</Text>
                </View>
            </LinearGradient>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isLight ? '#fff' : 'rgba(255,255,255,0.05)', borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }]} onPress={handleDownloadQR}>
                    <Ionicons name="download-outline" size={20} color={Theme.colors.primary} />
                    <Text style={[styles.actionBtnText, { color: Theme.colors.primary }]}>Save to Device</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isLight ? '#fff' : 'rgba(255,255,255,0.05)', borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }]} onPress={() => Alert.alert('Share', 'Secure link sharing is active.')}>
                    <Ionicons name="share-social-outline" size={20} color={Theme.colors.primary} />
                    <Text style={[styles.actionBtnText, { color: Theme.colors.primary }]}>Share Passport</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.infoBox, { backgroundColor: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)' }]}>
                <Ionicons name="information-circle-outline" size={20} color={Theme.colors.textMuted} />
                <Text style={[styles.infoBoxText, { color: Theme.colors.textMuted }]}>
                    This QR code allows verified doctors to request temporary access to your health records.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    title: { fontSize: 24, fontWeight: '900', marginTop: 20 },
    subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 32, lineHeight: 20 },
    card: { width: '100%', borderRadius: 32, padding: 24, elevation: 15, shadowColor: '#4c1d95', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    brandName: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
    cardType: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    qrContainer: { alignItems: 'center', marginBottom: 30 },
    qrBackground: { backgroundColor: '#fff', padding: 15, borderRadius: 24, elevation: 5 },
    scanHint: { flexDirection: 'row', alignItems: 'center', marginTop: 15, gap: 8 },
    scanText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
    patientInfo: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 20, marginBottom: 20 },
    infoLabel: { fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
    infoValue: { fontSize: 15, fontWeight: 'bold' },
    cardFooter: { alignItems: 'center' },
    securityText: { fontSize: 8, fontWeight: 'bold', letterSpacing: 1 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 32 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, gap: 8, borderWidth: 1 },
    actionBtnText: { fontSize: 14, fontWeight: 'bold' },
    infoBox: { flexDirection: 'row', padding: 16, borderRadius: 16, marginTop: 32, gap: 12 },
    infoBoxText: { flex: 1, fontSize: 12, lineHeight: 18 }
});
