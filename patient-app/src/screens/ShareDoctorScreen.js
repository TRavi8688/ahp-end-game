import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../contexts/AuthContext';
import { Theme, GlobalStyles } from '../theme';
import { HapticUtils } from '../utils/haptics';

export default function ShareDoctorScreen({ navigation }) {
    const { user } = useAuth();
    const hospynId = user?.hospyn_id || 'HOSPYN-ID-PENDING';

    const handleShare = async () => {
        HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Light);
        try {
            await Share.share({
                message: `Connect with my Hospyn Health Profile. My ID: ${hospynId}. Download Hospyn to view my clinical history.`,
            });
        } catch (error) {
            console.error(error.message);
        }
    };

    return (
        <View style={GlobalStyles.screen}>
            <LinearGradient colors={['#0F172A', '#050810']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={[GlobalStyles.heading, styles.headerTitle]}>CONNECT DOCTOR</Text>
                <View style={{ width: 24 }} />
            </LinearGradient>

            <View style={styles.content}>
                <Text style={styles.infoText}>Show this QR code to your doctor to grant them instant, secure access to your medical history.</Text>
                
                <View style={[styles.qrContainer, GlobalStyles.glass]}>
                    <View style={styles.qrInner}>
                        <QRCode
                            value={hospynId}
                            size={200}
                            color="#fff"
                            backgroundColor="transparent"
                        />
                    </View>
                    <Text style={styles.idLabel}>YOUR CLINICAL IDENTITY</Text>
                    <Text style={styles.idValue}>{hospynId}</Text>
                </View>

                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                    <Ionicons name="share-outline" size={20} color="#fff" />
                    <Text style={styles.shareBtnText}>SHARE ID MANUALLY</Text>
                </TouchableOpacity>

                <View style={styles.securityBox}>
                    <Ionicons name="shield-checkmark" size={24} color={Theme.colors.primary} />
                    <Text style={styles.securityText}>
                        Access is only granted for the duration of your visit. You can revoke it at any time from the "Connected Doctors" settings.
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 18, letterSpacing: 2 },
    backBtn: { padding: 4 },
    content: { flex: 1, padding: 30, alignItems: 'center' },
    infoText: { color: '#94A3B8', textAlign: 'center', lineHeight: 22, fontSize: 14, marginBottom: 40 },
    qrContainer: { padding: 40, borderRadius: 40, alignItems: 'center', width: '100%' },
    qrInner: { padding: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, marginBottom: 20 },
    idLabel: { color: '#64748B', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 5 },
    idValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', fontFamily: 'monospace' },
    shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 40, backgroundColor: Theme.colors.primary, px: 30, py: 15, borderRadius: 20 },
    shareBtnText: { color: '#fff', fontWeight: 'bold' },
    securityBox: { flexDirection: 'row', gap: 15, marginTop: 'auto', padding: 20, backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: 20, alignItems: 'center' },
    securityText: { flex: 1, color: '#64748B', fontSize: 12, lineHeight: 18 }
});
