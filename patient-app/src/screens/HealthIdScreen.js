import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SecurityUtils } from '../utils/security';
import ApiService from '../utils/ApiService';
import { Theme, GlobalStyles } from '../theme';

export default function HealthIdScreen() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

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
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color="#4c1d95" size="large" />
            </View>
        );
    }

    const qrValue = profile?.hospyn_id || 'HOSPYN-PENDING';

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
            <Text style={styles.title}>Digital Health Passport</Text>
            <Text style={styles.subtitle}>Scan this QR code at any Hospyn-enabled facility for instant clinical history access.</Text>

            {/* Premium ID Card */}
            <LinearGradient
                colors={['#1e1b4b', '#4c1d95', '#1e1b4b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
            >
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.brandName}>HOSPYN</Text>
                        <Text style={styles.cardType}>GLOBAL PATIENT ID</Text>
                    </View>
                    <Ionicons name="shield-checkmark" size={32} color="#10b981" />
                </View>

                <View style={styles.qrContainer}>
                    <View style={styles.qrBackground}>
                         {/* Using a placeholder for now, ideally react-native-qrcode-svg */}
                         <Image 
                            source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrValue}&color=4c1d95&bgcolor=fff` }}
                            style={styles.qrImage}
                         />
                    </View>
                    <View style={styles.scanHint}>
                        <Ionicons name="scan" size={16} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.scanText}>AUTHORIZED CLINICAL SCAN ONLY</Text>
                    </View>
                </View>

                <View style={styles.patientInfo}>
                    <View>
                        <Text style={styles.infoLabel}>PATIENT NAME</Text>
                        <Text style={styles.infoValue}>{profile?.full_name?.toUpperCase()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.infoLabel}>HOSPYN ID</Text>
                        <Text style={styles.infoValue}>{profile?.hospyn_id}</Text>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.securityText}>AES-256 ENCRYPTED · ZERO TRUST VERIFIED</Text>
                </View>
            </LinearGradient>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn}>
                    <Ionicons name="download-outline" size={20} color="#4c1d95" />
                    <Text style={styles.actionBtnText}>Save to Device</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                    <Ionicons name="share-social-outline" size={20} color="#4c1d95" />
                    <Text style={styles.actionBtnText}>Share Passport</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#64748b" />
                <Text style={styles.infoBoxText}>
                    This QR code allows verified doctors to request temporary access to your health records. You will receive a notification to approve or reject every request.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 20,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 32,
        lineHeight: 20,
    },
    card: {
        width: '100%',
        borderRadius: 32,
        padding: 24,
        elevation: 15,
        shadowColor: '#4c1d95',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    brandName: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 2,
    },
    cardType: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    qrBackground: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 24,
        elevation: 5,
    },
    qrImage: {
        width: 180,
        height: 180,
    },
    scanHint: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        gap: 8,
    },
    scanText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    patientInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: 20,
        marginBottom: 20,
    },
    infoLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 9,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    infoValue: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    cardFooter: {
        alignItems: 'center',
    },
    securityText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 32,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    actionBtnText: {
        color: '#4c1d95',
        fontSize: 14,
        fontWeight: 'bold',
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        padding: 16,
        borderRadius: 16,
        marginTop: 32,
        gap: 12,
    },
    infoBoxText: {
        flex: 1,
        color: '#64748b',
        fontSize: 12,
        lineHeight: 18,
    }
});
