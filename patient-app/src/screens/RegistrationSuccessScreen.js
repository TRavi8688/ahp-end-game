import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Image } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { Theme, GlobalStyles } from '../theme';
import HapticUtils from '../utils/HapticUtils';
import { useAuth } from '../contexts/AuthContext';

export default function RegistrationSuccessScreen({ navigation, route }) {
    const { hospyn_id, fullName } = route.params || { hospyn_id: 'Hospyn-IN-XXXX-XXXX-XX', fullName: 'Patient' };
    const { setIsAuthenticated } = useAuth();

    const copyToClipboard = async () => {
        HapticUtils.success();
        await Clipboard.setStringAsync(hospyn_id);
    };

    const onShare = async () => {
        HapticUtils.medium();
        try {
            await Share.share({
                message: `My Hospyn Health Passport ID is ${hospyn_id}. Scan this to view my medical history.`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: '#050810' }]}>
            <LinearGradient colors={['#050810', '#1E1B4B']} style={styles.header}>
                <View style={styles.successIcon}>
                    <Ionicons name="checkmark-circle" size={80} color={Theme.colors.primary} />
                </View>
                <Text style={styles.welcomeText}>Welcome to Hospyn,</Text>
                <Text style={[styles.nameText, GlobalStyles.heading]}>{fullName}!</Text>
                <Text style={styles.subtitle}>Your AI Health Passport is ready.</Text>
            </LinearGradient>

            <View style={styles.content}>
                <View style={[styles.idCard, GlobalStyles.glass]}>
                    <Text style={styles.idLabel}>YOUR UNIQUE HOSPYN ID</Text>
                    <View style={styles.idRow}>
                        <Text style={[styles.idValue, { color: '#fff' }]}>{hospyn_id}</Text>
                        <TouchableOpacity onPress={copyToClipboard} style={styles.copyBtn}>
                            <Ionicons name="copy-outline" size={20} color={Theme.colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.qrContainer}>
                        <View style={styles.qrWrapper}>
                            <QRCode
                                value={hospyn_id}
                                size={160}
                                color="#fff"
                                backgroundColor="transparent"
                                logo={require('../../assets/logo.png')}
                                logoSize={40}
                                logoBackgroundColor='transparent'
                            />
                            <Text style={[styles.qrText, { color: Theme.colors.primary, marginTop: 15 }]}>SCAN TO CONNECT</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.benefitSection}>
                    <Text style={[styles.benefitTitle, { color: '#fff' }]}>What's Next?</Text>
                    <View style={styles.benefitItem}>
                        <Ionicons name="cloud-upload-outline" size={24} color={Theme.colors.primary} />
                        <Text style={[styles.benefitText, { color: '#94A3B8' }]}>Upload your medical reports for AI analysis.</Text>
                    </View>
                    <View style={styles.benefitItem}>
                        <Ionicons name="people-outline" size={24} color={Theme.colors.primary} />
                        <Text style={[styles.benefitText, { color: '#94A3B8' }]}>Share your Hospyn ID with doctors for instant consultation.</Text>
                    </View>
                </View>

                <TouchableOpacity style={[styles.mainButton, { backgroundColor: Theme.colors.primary }]} onPress={() => { HapticUtils.heavy(); setIsAuthenticated(true); }}>
                    <Text style={styles.mainButtonText}>Go to Dashboard</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 10 }} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareButton} onPress={onShare}>
                    <Ionicons name="share-social-outline" size={20} color={Theme.colors.secondary} />
                    <Text style={[styles.shareButtonText, { color: Theme.colors.secondary }]}>Share Passport</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050810' },
    header: {
        paddingTop: 80,
        paddingBottom: 40,
        alignItems: 'center',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
    },
    successIcon: {
        marginBottom: 20,
        shadowColor: Theme.colors.primary,
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    welcomeText: { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '600' },
    nameText: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 5 },
    subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 10 },
    content: { padding: 25, flex: 1, justifyContent: 'space-between' },
    idCard: {
        borderRadius: 30,
        padding: 25,
        marginTop: -60,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    idLabel: { color: '#22D3EE', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
    idRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 15,
        marginTop: 15,
    },
    idValue: { fontSize: 20, fontWeight: '900', color: '#fff', marginRight: 15, letterSpacing: 1 },
    qrContainer: { marginTop: 25, alignItems: 'center' },
    qrWrapper: {
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    qrText: { marginTop: 10, color: '#22D3EE', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    benefitSection: { marginTop: 20 },
    benefitTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
    benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 15 },
    benefitText: { fontSize: 14, color: '#94A3B8', flex: 1, lineHeight: 20 },
    mainButton: {
        height: 60,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    mainButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    shareButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
    },
    shareButtonText: { color: '#22D3EE', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
});
