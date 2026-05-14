import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, Modal, ActivityIndicator, Alert, Dimensions, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Theme, GlobalStyles } from '../theme';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
    const { isAuthenticated, logout, user, switchProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { lastMessage } = useSocket();
    const [showConsent, setShowConsent] = useState(false);
    const [consentData, setConsentData] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [greeting, setGreeting] = useState('');
    const [showVisitModal, setShowVisitModal] = useState(false);
    const [visitStep, setVisitStep] = useState(1); // 1: Scan, 2: Details, 3: Success
    const [scannedHospital, setScannedHospital] = useState(null);
    const [visitReason, setVisitReason] = useState('');
    const [visitSymptoms, setVisitSymptoms] = useState('');
    const [visitDept, setVisitDept] = useState('');
    const [visitDoctor, setVisitDoctor] = useState('');
    const [visitResult, setVisitResult] = useState(null);
    const [manualQR, setManualQR] = useState('');

    // Animation values
    const orbScale = useSharedValue(1);
    const orbOpacity = useSharedValue(0.6);

    const getGreeting = useCallback(() => {
        const hour = new Date().getHours();
        if (!summary?.patient_name && !profile?.full_name) return "Welcome to Hospyn";
        
        const name = summary?.patient_name || profile?.full_name || 'there';
        if (hour < 12) return `Good morning, ${name}`;
        if (hour < 17) return `Good afternoon, ${name}`;
        return `Good evening, ${name}`;
    }, [summary, profile]);

    const fetchData = async () => {
        if (!isAuthenticated) return;
        
        try {
            const [profileRes, summaryRes, accessRes] = await Promise.allSettled([
                ApiService.getProfile(),
                ApiService.getClinicalSummary(),
                ApiService.getPendingAccess()
            ]);

            if (profileRes.status === 'fulfilled') setProfile(profileRes.value);
            if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
            
            if (accessRes.status === 'fulfilled' && accessRes.value?.length > 0) {
                setConsentData(accessRes.value[0]);
                setShowConsent(true);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        setGreeting(getGreeting());
    }, [getGreeting]);

    // Hero Animation Logic
    useEffect(() => {
        orbScale.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 2000 }),
                withTiming(1, { duration: 2000 })
            ),
            -1,
            true
        );
        orbOpacity.value = withRepeat(
            withSequence(
                withTiming(0.8, { duration: 2000 }),
                withTiming(0.4, { duration: 2000 })
            ),
            -1,
            true
        );
    }, []);

    const animatedOrbStyle = useAnimatedStyle(() => ({
        transform: [{ scale: orbScale.value }],
        opacity: orbOpacity.value,
    }));

    const handleLogMedication = async (medId, medName) => {
        try {
            await ApiService.logMedication(medId);
            Alert.alert("Success", `Logged intake for ${medName}`);
            fetchData(); // Refresh to update "taken_today" status
        } catch (error) {
            Alert.alert("Error", "Failed to log medication.");
        }
    };

    const handleSwitchProfile = async (memberId) => {
        setLoading(true);
        try {
            const success = await switchProfile(memberId);
            if (success) {
                // Fetch data for the new context
                await fetchData();
            } else {
                Alert.alert("Error", "Failed to switch profile.");
            }
        } catch (err) {
            console.error('Switch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleScanQR = async () => {
        if (!manualQR) return;
        setActionLoading(true);
        try {
            const hospital = await ApiService.scanHospitalQR(manualQR);
            setScannedHospital(hospital);
            setVisitStep(2);
        } catch (error) {
            Alert.alert("Error", "Invalid QR Code or Hospital not found.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmitVisit = async () => {
        if (!visitReason) {
            Alert.alert("Required", "Please provide a reason for your visit.");
            return;
        }
        setActionLoading(true);
        try {
            const result = await ApiService.createVisit(
                scannedHospital.qr_data, 
                visitReason, 
                visitSymptoms,
                visitDept,
                visitDoctor
            );
            setVisitResult(result);
            setVisitStep(3);
            fetchData(); 
        } catch (error) {
            Alert.alert("Error", "Failed to register visit.");
        } finally {
            setActionLoading(false);
        }
    };

    const resetVisitFlow = () => {
        setShowVisitModal(false);
        setVisitStep(1);
        setScannedHospital(null);
        setVisitReason('');
        setVisitSymptoms('');
        setVisitDept('');
        setVisitDoctor('');
        setVisitResult(null);
        setManualQR('');
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={Theme.colors.primary} size="large" />
                <Text style={styles.loadingText}>INITIALIZING YOUR HEALTH COMPANION...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
            showsVerticalScrollIndicator={false}
        >
            {/* 1. Premium Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.iconBtn}>
                            <Ionicons name="notifications-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
                            <Ionicons name="person-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.greetingSection}>
                    <Text style={styles.greetingText}>{greeting}</Text>
                    <View style={styles.subGreetingRow}>
                        <Text style={styles.subGreeting}>{profile?.is_family_member ? `${profile.relation} Profile` : 'Personal Health Shield'}</Text>
                        {profile?.is_family_member && (
                            <TouchableOpacity style={styles.backToMeBtn} onPress={() => handleSwitchProfile(null)}>
                                <Text style={styles.backToMeText}>Back to Me</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* 2. Hero Section (Digital Health Passport) */}
            <View style={styles.heroContainer}>
                <TouchableOpacity 
                    onPress={() => Alert.alert("Digital Health Passport", `Your unique Hospyn ID: ${profile?.hospyn_id}\n\nThis passport allows hospitals to instantly sync your clinical history securely.`)}
                    activeOpacity={0.9}
                >
                    <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.heroCard}>
                        {/* Security Badge */}
                        <View style={styles.securityBadge}>
                            <Ionicons name="shield-checkmark" size={12} color="#10b981" />
                            <Text style={styles.securityText}>AES-256 SECURED</Text>
                        </View>

                        <View style={styles.passportMain}>
                            <View style={styles.qrContainer}>
                                <View style={styles.qrRing} />
                                <View style={styles.qrRingOuter} />
                                <Animated.View style={[styles.glowOrb, animatedOrbStyle]} />
                                <Ionicons name="qr-code" size={40} color={Theme.colors.primary} />
                            </View>
                            
                            <Text style={styles.passportTitle}>DIGITAL HEALTH PASSPORT</Text>
                            <Text style={styles.passportId}>{profile?.hospyn_id || 'HOSPYN-000000-TEST'}</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* NEW: Quick Action - New Visit */}
            <View style={styles.section}>
                <TouchableOpacity 
                    style={styles.newVisitBtn}
                    onPress={() => setShowVisitModal(true)}
                >
                    <LinearGradient 
                        colors={[Theme.colors.primary, '#4c1d95']} 
                        start={{x: 0, y: 0}} 
                        end={{x: 1, y: 0}}
                        style={styles.newVisitGradient}
                    >
                        <Ionicons name="add-circle" size={24} color="#fff" />
                        <Text style={styles.newVisitText}>NEW HOSPITAL VISIT</Text>
                        <Ionicons name="scan-outline" size={20} color="#fff" style={{ marginLeft: 'auto' }} />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* 3. Today's Medications (Priority Actions) */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Today's Medications</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Meds')}>
                        <Text style={styles.viewAll}>Schedule</Text>
                    </TouchableOpacity>
                </View>
                
                {summary?.today_medications?.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {summary.today_medications.map((med, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={[styles.medCard, med.taken_today && styles.medCardTaken]}
                                onPress={() => !med.taken_today && handleLogMedication(med.id, med.name)}
                            >
                                <View style={styles.medCardHeader}>
                                    <Ionicons name="medkit" size={20} color={med.taken_today ? "#10b981" : Theme.colors.primary} />
                                    {med.taken_today && <Ionicons name="checkmark-circle" size={16} color="#10b981" />}
                                </View>
                                <Text style={styles.medName} numberOfLines={1}>{med.name}</Text>
                                <Text style={styles.medDosage}>{med.dosage}</Text>
                                <Text style={styles.medTime}>{med.frequency}</Text>
                                <TouchableOpacity 
                                    style={[styles.takeBtn, med.taken_today && styles.takeBtnDisabled]}
                                    onPress={() => handleLogMedication(med.id, med.name)}
                                    disabled={med.taken_today}
                                >
                                    <Text style={styles.takeBtnText}>{med.taken_today ? 'DONE' : 'LOG DOSE'}</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : (
                    <View style={[styles.emptySection, GlobalStyles.glass]}>
                        <Text style={styles.emptyText}>No medications scheduled for today.</Text>
                    </View>
                )}
            </View>

            {/* 4. Ongoing Medications (Full Context) */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ongoing Medications</Text>
                <View style={styles.ongoingList}>
                    {summary?.ongoing_medications?.length > 0 ? (
                        summary.ongoing_medications.map((med, index) => (
                            <View key={index} style={[styles.ongoingItem, GlobalStyles.glass]}>
                                <View style={styles.ongoingIcon}>
                                    <Ionicons name="medical" size={18} color={Theme.colors.secondary} />
                                </View>
                                <View style={styles.ongoingInfo}>
                                    <Text style={styles.ongoingName}>{med.name}</Text>
                                    <Text style={styles.ongoingSub}>{med.dosage} • {med.frequency}</Text>
                                </View>
                                <View style={styles.ongoingStatus}>
                                    <Text style={styles.statusText}>ACTIVE</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No active medications found.</Text>
                    )}
                </View>
            </View>

            {/* 5. Family Pulse */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Family Pulse</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('FamilyProfiles')}>
                        <Text style={styles.viewAll}>Manage</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.familyRow}>
                    <TouchableOpacity style={styles.addFamilyCircle} onPress={() => navigation.navigate('FamilyProfiles')}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                    
                    {/* Primary User Profile */}
                    <TouchableOpacity 
                        style={styles.familyMember} 
                        onPress={() => handleSwitchProfile(null)}
                    >
                        <View style={[styles.memberAvatar, !profile?.is_family_member && styles.activeMemberAvatar, { backgroundColor: '#4c1d95' }]}>
                            <Text style={styles.avatarInitials}>ME</Text>
                            {!profile?.is_family_member && <View style={styles.statusDot} />}
                        </View>
                        <Text style={[styles.memberName, !profile?.is_family_member && styles.activeMemberName]}>Self</Text>
                    </TouchableOpacity>

                    {profile?.care_circle?.map((member, i) => (
                        <TouchableOpacity 
                            key={i} 
                            style={styles.familyMember}
                            onPress={() => handleSwitchProfile(member.id)}
                        >
                            <View style={[styles.memberAvatar, profile?.id === member.id && styles.activeMemberAvatar]}>
                                <Text style={styles.avatarInitials}>{member.full_name[0]}</Text>
                                {profile?.id === member.id && <View style={styles.statusDot} />}
                            </View>
                            <Text style={[styles.memberName, profile?.id === member.id && styles.activeMemberName]}>{member.full_name.split(' ')[0]}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* 6. AI Health Summary Card */}
            <View style={styles.section}>
                <TouchableOpacity 
                    style={[styles.chittiCard, GlobalStyles.glass]}
                    onPress={() => navigation.navigate('Chitti AI')}
                >
                    <View style={styles.chittiHeader}>
                        <Image source={require('../../assets/chitti_avatar.png')} style={styles.chittiIcon} />
                        <View>
                            <Text style={styles.chittiTitle}>CHITTI AI INSIGHT</Text>
                            <Text style={styles.chittiStatus}>Status: Analysing Trends</Text>
                        </View>
                    </View>
                    <Text style={styles.chittiText}>
                        {summary?.summary || (profile?.full_name ? `Hello ${profile.full_name.split(' ')[0]}! I'm Chitti, your AI health companion. I've secured your Health Passport. To get started, you can tell me how you're feeling or upload a report.` : "Upload your latest medical reports to let Chitti AI analyze your health trends.")}
                    </Text>
                    <LinearGradient colors={[Theme.colors.primary, '#4c1d95']} style={styles.chatBtn}>
                        <Text style={styles.chatBtnText}>ASK CHITTI ANYTHING</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <View style={{ height: 100 }} />

            {/* NEW VISIT MODAL */}
            <Modal
                visible={showVisitModal}
                transparent={true}
                animationType="slide"
                onRequestClose={resetVisitFlow}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, GlobalStyles.glass]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Hospital Visit</Text>
                            <TouchableOpacity onPress={resetVisitFlow}>
                                <Ionicons name="close" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {visitStep === 1 && (
                            <View style={styles.visitStepContent}>
                                <View style={styles.scanPlaceholder}>
                                    <Ionicons name="scan" size={60} color={Theme.colors.primary} />
                                    <Text style={styles.scanHint}>Scan Hospital QR Code</Text>
                                </View>
                                <View style={styles.manualInputGroup}>
                                    <Text style={styles.inputLabel}>OR ENTER HOSPITAL CODE</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="business" size={20} color="#64748B" />
                                        <TextInput 
                                            style={styles.textInput}
                                            placeholder="Enter Code (e.g. CITY-001)"
                                            placeholderTextColor="#475569"
                                            value={manualQR}
                                            onChangeText={setManualQR}
                                            autoCapitalize="characters"
                                        />
                                    </View>
                                    <View style={styles.demoCodes}>
                                        <Text style={styles.demoTitle}>Demo Hospital Codes:</Text>
                                        <TouchableOpacity onPress={() => setManualQR('CITY-001')}>
                                            <Text style={styles.demoCode}>CITY-001 (City General Hospital)</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setManualQR('APOLLO-01')}>
                                            <Text style={styles.demoCode}>APOLLO-01 (Apollo Healthcare)</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity 
                                        style={[styles.primaryBtn, !manualQR && styles.btnDisabled]} 
                                        onPress={handleScanQR}
                                        disabled={!manualQR || actionLoading}
                                    >
                                        {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>VERIFY HOSPITAL</Text>}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {visitStep === 2 && scannedHospital && (
                            <ScrollView style={styles.visitStepContent}>
                                <View style={styles.hospitalInfoCard}>
                                    <Ionicons name="business" size={32} color={Theme.colors.primary} />
                                    <View>
                                        <Text style={styles.scannedHospitalName}>{scannedHospital.name}</Text>
                                        <Text style={styles.scannedHospitalId}>Hospyn ID: {scannedHospital.hospyn_id}</Text>
                                    </View>
                                </View>
                                
                                <Text style={styles.inputLabel}>REASON FOR VISIT</Text>
                                <View style={styles.textAreaWrapper}>
                                    <TextInput 
                                        style={styles.textArea}
                                        placeholder="e.g. Regular checkup, Fever"
                                        placeholderTextColor="#475569"
                                        value={visitReason}
                                        onChangeText={setVisitReason}
                                        multiline
                                    />
                                </View>

                                <View style={{ flexDirection: 'row', gap: 15 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>DEPARTMENT</Text>
                                        <View style={styles.inputWrapper}>
                                            <TextInput 
                                                style={styles.textInput}
                                                placeholder="e.g. Cardiology"
                                                placeholderTextColor="#475569"
                                                value={visitDept}
                                                onChangeText={setVisitDept}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>DOCTOR (OPTIONAL)</Text>
                                        <View style={styles.inputWrapper}>
                                            <TextInput 
                                                style={styles.textInput}
                                                placeholder="Dr. Smith"
                                                placeholderTextColor="#475569"
                                                value={visitDoctor}
                                                onChangeText={setVisitDoctor}
                                            />
                                        </View>
                                    </View>
                                </View>

                                <Text style={styles.inputLabel}>SYMPTOMS (OPTIONAL)</Text>
                                <View style={styles.textAreaWrapper}>
                                    <TextInput 
                                        style={styles.textArea}
                                        placeholder="Describe any symptoms..."
                                        placeholderTextColor="#475569"
                                        value={visitSymptoms}
                                        onChangeText={setVisitSymptoms}
                                        multiline
                                    />
                                </View>

                                <TouchableOpacity 
                                    style={styles.primaryBtn} 
                                    onPress={handleSubmitVisit}
                                    disabled={actionLoading || !visitReason}
                                >
                                    {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>SUBMIT VISIT DETAILS</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        )}

                        {visitStep === 3 && visitResult && (
                            <View style={styles.visitStepContent}>
                                <View style={styles.successAnimation}>
                                    <Ionicons name="checkmark-circle" size={80} color="#10b981" />
                                    <Text style={styles.successTitle}>CHECK-IN SUCCESSFUL</Text>
                                    <Text style={styles.successSub}>Your details have been shared with {scannedHospital?.name}</Text>
                                </View>
                                
                                <View style={styles.tokenCard}>
                                    <Text style={styles.tokenLabel}>QUEUE TOKEN</Text>
                                    <Text style={styles.tokenValue}>{visitResult.queue_token}</Text>
                                    <Text style={styles.tokenHint}>Please wait for your turn. You will be notified.</Text>
                                </View>

                                <TouchableOpacity style={styles.secondaryBtn} onPress={resetVisitFlow}>
                                    <Text style={styles.secondaryBtnText}>BACK TO DASHBOARD</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050810',
    },
    loadingText: {
        color: '#6366F1',
        fontSize: 12,
        marginTop: 20,
        fontFamily: Theme.fonts.label,
        letterSpacing: 1,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    logo: {
        width: 44,
        height: 44,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    greetingSection: {
        marginTop: 10,
    },
    greetingText: {
        fontSize: 28,
        fontFamily: Theme.fonts.heading,
        color: '#fff',
        fontWeight: '900',
    },
    subGreetingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    subGreeting: {
        fontSize: 16,
        color: '#94A3B8',
        fontFamily: Theme.fonts.body,
    },
    backToMeBtn: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    backToMeText: {
        color: Theme.colors.primary,
        fontSize: 11,
        fontWeight: 'bold',
    },
    heroContainer: {
        paddingHorizontal: 20,
        marginBottom: 25,
    },
    heroCard: {
        borderRadius: 24,
        padding: 24,
        height: 180,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    securityBadge: {
        position: 'absolute',
        top: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 5,
    },
    securityText: {
        color: '#10b981',
        fontSize: 9,
        fontWeight: '900',
    },
    passportMain: {
        alignItems: 'center',
        marginTop: 10,
    },
    qrContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        position: 'relative',
    },
    qrRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.1)',
    },
    qrRingOuter: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.05)',
    },
    passportTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
        textAlign: 'center',
    },
    passportId: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 4,
        letterSpacing: 1,
    },
    glowOrb: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Theme.colors.primary,
        opacity: 0.1,
    },
    newVisitBtn: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    newVisitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 15,
    },
    newVisitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        minHeight: 500,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    visitStepContent: {
        flex: 1,
    },
    scanPlaceholder: {
        height: 200,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        marginBottom: 30,
    },
    scanHint: {
        color: '#94A3B8',
        fontSize: 14,
        marginTop: 10,
    },
    manualInputGroup: {
        gap: 15,
    },
    inputLabel: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    textInput: {
        flex: 1,
        height: 50,
        color: '#fff',
        fontSize: 16,
        paddingLeft: 12,
    },
    textArea: {
        color: '#fff',
        fontSize: 15,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    demoCodes: {
        padding: 15,
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.1)',
    },
    demoTitle: {
        color: '#94A3B8',
        fontSize: 12,
        marginBottom: 8,
    },
    demoCode: {
        color: Theme.colors.primary,
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    primaryBtn: {
        backgroundColor: Theme.colors.primary,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    btnDisabled: {
        opacity: 0.5,
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    hospitalInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    scannedHospitalName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    scannedHospitalId: {
        color: '#64748B',
        fontSize: 12,
    },
    textAreaWrapper: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    successAnimation: {
        alignItems: 'center',
        marginVertical: 30,
    },
    successTitle: {
        color: '#10b981',
        fontSize: 20,
        fontWeight: '900',
        marginTop: 15,
    },
    successSub: {
        color: '#94A3B8',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
    },
    tokenCard: {
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(16, 185, 129, 0.2)',
        marginBottom: 30,
    },
    tokenLabel: {
        color: '#10b981',
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    tokenValue: {
        color: '#fff',
        fontSize: 48,
        fontWeight: '900',
        marginVertical: 10,
    },
    tokenHint: {
        color: '#64748B',
        fontSize: 12,
        textAlign: 'center',
    },
    secondaryBtn: {
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    secondaryBtnText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: 'bold',
    },
    section: {
        paddingHorizontal: 24,
        marginBottom: 30,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        color: '#fff',
        fontWeight: '800',
        fontFamily: Theme.fonts.headingSemi,
    },
    viewAll: {
        color: Theme.colors.primary,
        fontSize: 14,
        fontWeight: 'bold',
    },
    horizontalScroll: {
        marginLeft: -24,
        paddingLeft: 24,
    },
    medCard: {
        width: 160,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        padding: 20,
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    medCardTaken: {
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    medCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    medName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    medDosage: {
        color: '#94A3B8',
        fontSize: 12,
        marginBottom: 2,
    },
    medTime: {
        color: Theme.colors.primary,
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    takeBtn: {
        backgroundColor: Theme.colors.primary,
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: 'center',
    },
    takeBtnDisabled: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    takeBtnText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
    ongoingList: {
        gap: 12,
    },
    ongoingItem: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
    },
    ongoingIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    ongoingInfo: {
        flex: 1,
    },
    ongoingName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    ongoingSub: {
        color: '#64748B',
        fontSize: 13,
        marginTop: 2,
    },
    ongoingStatus: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    statusText: {
        color: '#22C55E',
        fontSize: 10,
        fontWeight: 'bold',
    },
    familyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    addFamilyCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    familyMember: {
        alignItems: 'center',
    },
    memberAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Theme.colors.primary,
    },
    activeMemberAvatar: {
        borderColor: '#10b981',
        borderWidth: 3,
    },
    activeMemberName: {
        color: '#fff',
        fontWeight: 'bold',
    },
    avatarInitials: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    statusDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10b981',
        borderWidth: 2,
        borderColor: '#050810',
    },
    memberName: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 8,
    },
    chittiCard: {
        padding: 24,
        borderRadius: 32,
    },
    chittiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        marginBottom: 16,
    },
    chittiIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    chittiTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    },
    chittiStatus: {
        color: '#10b981',
        fontSize: 11,
    },
    chittiText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 15,
        lineHeight: 24,
        marginBottom: 20,
    },
    chatBtn: {
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    chatBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    emptySection: {
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
    },
    emptyText: {
        color: '#64748B',
        fontSize: 14,
        fontStyle: 'italic',
    }
});
