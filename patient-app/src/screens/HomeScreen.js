import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, Modal, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../utils/ApiService';

export default function HomeScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { lastMessage } = useSocket();
    const [showConsent, setShowConsent] = useState(false);
    const [consentData, setConsentData] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [timeline, setTimeline] = useState([]);

    const fetchData = async () => {
        try {
            const [profileData, summaryData, pendingAccess, timelineData] = await Promise.all([
                ApiService.getProfile(),
                ApiService.getClinicalSummary(),
                ApiService.getPendingAccess(),
                ApiService.getTimeline()
            ]);

            setProfile(profileData);
            setSummary(summaryData);
            setTimeline(timelineData.slice(0, 3)); // Only show top 3 on home
            
            if (pendingAccess && pendingAccess.length > 0) {
                setConsentData(pendingAccess[0]);
                setShowConsent(true);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            if (error.response?.status === 401) {
                navigation.replace('Login');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (lastMessage?.type === 'patient_update') {
            console.log('Real-time sync triggered by socket:', lastMessage);
            fetchData();
        }
        if (lastMessage?.type === 'consent_request') {
            setConsentData(lastMessage.payload);
            setShowConsent(true);
        }
    }, [lastMessage]);

    const handleConsentAction = async (action) => {
        if (!consentData) return;
        setActionLoading(true);
        try {
            if (action === 'approve') {
                await ApiService.approveAccess(consentData.access_id);
            } else {
                await ApiService.revokeAccess(consentData.access_id);
            }

            setShowConsent(false);
            Alert.alert("Success", `Access ${action === 'approve' ? 'granted' : 'rejected'} successfully.`);
            fetchData(); // Refresh to clear modal and update state
        } catch (error) {
            console.error('Consent action error:', error);
            Alert.alert("Error", "Failed to process consent request.");
        } finally {
            setActionLoading(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={Theme.colors.primary} />
                <Text style={{ color: '#4c1d95', fontSize: 16, marginTop: 10, fontFamily: Theme.fonts.label }}>INITIALIZING SNAPSHOT...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4c1d95" />}
        >
            {/* 1. Patient Header */}
            <LinearGradient colors={['#050810', '#1E1B4B']} style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.profileRow}>
                        <View style={[styles.avatar, GlobalStyles.glass]}>
                            <Ionicons name="person" size={30} color="#fff" />
                        </View>
                        <View style={styles.headerText}>
                            <Text style={[styles.userName, GlobalStyles.heading]}>{summary?.patient_name || profile?.full_name || 'Patient'}</Text>
                            <Text style={styles.patientSub}>
                                Age: {summary?.age || profile?.age || 'N/A'} | {summary?.blood_group || profile?.blood_group || 'N/A'}
                            </Text>
                            <View style={[styles.idBadge, GlobalStyles.glass]}>
                                <Text style={styles.idText}>MULAJNA ID: {summary?.ahp_id || profile?.ahp_id}</Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
                        <Ionicons name="notifications-outline" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* 1b. AI Health Summary */}
                <View style={[styles.summaryCard, GlobalStyles.glass]}>
                    <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
                         <View style={{ flex: 1 }}>
                            <View style={styles.summaryBadge}>
                                <Ionicons name="sparkles" size={14} color="#fff" />
                                <Text style={styles.summaryBadgeText}>CHITTI CLINICAL INSIGHT</Text>
                            </View>
                            <Text style={styles.summaryText} numberOfLines={4}>
                                {summary?.summary || 'No clinical summary available. Upload a medical record to allow Chitti AI to analyze your health.'}
                            </Text>
                         </View>
                    </View>
                    <Text style={styles.lastUpdate}>SYNCED: {summary?.last_update || 'LIVE'}</Text>
                </View>
            </LinearGradient>

            {/* 2. Optimization Factors */}
            {summary?.health_score_factors?.length > 0 && (
                <View style={styles.scoreSection}>
                    <Text style={[styles.sectionTitle, { fontSize: 13, color: '#64748b', marginBottom: 8 }]}>OPTIMIZATION FACTORS</Text>
                    <View style={styles.factorTags}>
                        {summary.health_score_factors?.map((f, i) => (
                            <View key={i} style={styles.factorTag}>
                                <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                                <Text style={styles.factorText}>{f}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* 3. Recovery Timeline (Visual Chart) */}
            {summary?.recovery_timeline?.length > 0 && (
                <View style={styles.chartSection}>
                    <Text style={styles.sectionTitle}>Health Progress Timeline</Text>
                    <View style={styles.timelineChart}>
                        {Array.isArray(summary.recovery_timeline) && summary.recovery_timeline.map((point, i) => (
                            <View key={i} style={styles.timelineBarGroup}>
                                <Text style={styles.timelineYear}>{point.year}</Text>
                                <View style={styles.barContainer}>
                                    <View style={[styles.barFill, { height: point.level * 1.5 }]} />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* 4. Condition Progress Tracker */}
            {Object.keys(summary?.condition_progress || {}).length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Condition Progress</Text>
                    {Object.entries(summary.condition_progress).map(([name, trends], i) => (
                        <View key={i} style={styles.conditionCard}>
                            <View style={styles.conditionHeader}>
                                <Text style={styles.conditionName}>{name}</Text>
                                <Ionicons name="trending-down" size={20} color="#10b981" />
                            </View>
                            <View style={styles.trendRow}>
                                {Array.isArray(trends) && trends.map((t, idx) => (
                                    <View key={idx} style={styles.trendItem}>
                                        <Text style={styles.trendVal}>{t.value}</Text>
                                        <Text style={styles.trendDate}>{t.date}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* 5. Medication Impact */}
            {summary?.medication_impact?.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Medication Impact</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.impactScroll}>
                        {Array.isArray(summary.medication_impact) && summary.medication_impact.map((med, i) => (
                            <View key={i} style={styles.impactCard}>
                                <Ionicons name="medkit" size={24} color="#4c1d95" />
                                <Text style={styles.impactMedName}>{med.name}</Text>
                                <Text style={styles.impactImprovement}>{med.improvement}</Text>
                                <Text style={styles.impactLabel}>Improvement</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* 7. Health Alerts */}
            {summary?.alerts?.length > 0 && (
                <View style={styles.alertSection}>
                    {Array.isArray(summary.alerts) && summary.alerts.map((alert, i) => (
                        <View key={i} style={styles.alertBox}>
                            <Ionicons name="warning" size={20} color="#b91c1c" />
                            <Text style={styles.alertText}>{alert}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* 8. Clinical Journey Preview */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Clinical Journey</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Timeline')}>
                        <Text style={styles.viewAll}>Full Timeline</Text>
                    </TouchableOpacity>
                </View>
                
                {timeline.length > 0 ? (
                    timeline.map((event, index) => (
                        <View key={event.id} style={styles.timelinePreviewCard}>
                            <View style={[styles.timelineDot, { backgroundColor: index === 0 ? '#7c3aed' : '#cbd5e1' }]} />
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineSummary}>{event.summary}</Text>
                                <Text style={styles.timelineTime}>
                                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyTimeline}>
                        <Text style={styles.emptyTimelineText}>No clinical actions recorded yet.</Text>
                    </View>
                )}
            </View>

            {/* 9. Reports Overview */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Record History</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Records')}>
                        <Text style={styles.viewAll}>View All</Text>
                    </TouchableOpacity>
                </View>

                {profile?.recent_records?.length > 0 ? (
                    profile.recent_records.slice(0, 3).map((record, index) => (
                        <TouchableOpacity key={index} style={styles.activityCard} onPress={() => navigation.navigate('Records')}>
                            <View style={styles.activityIcon}>
                                <Ionicons name="document-text" size={20} color="#4c1d95" />
                            </View>
                            <View style={styles.activityInfo}>
                                <Text style={styles.activityTitle}>{record.title || 'Medical Record'}</Text>
                                <Text style={styles.activityDate}>{new Date(record.created_at).toLocaleDateString()}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                        </TouchableOpacity>
                    ))
                ) : (
                    <TouchableOpacity style={styles.uploadPrompt} onPress={() => navigation.navigate('Records')}>
                        <Ionicons name="cloud-upload-outline" size={40} color="#4c1d95" />
                        <Text style={styles.uploadText}>No records found. Upload now.</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* 10. AI Assistant CTA */}
            <TouchableOpacity
                style={styles.aiAssistantCard}
                onPress={() => navigation.navigate('Chitti')}
            >
                <LinearGradient colors={['#1e1b4b', '#4c1d95']} style={styles.aiGradient}>
                    <View style={styles.aiContent}>
                        <View style={styles.aiTextGroup}>
                            <Text style={styles.aiTitle}>Chat with Chitti AI</Text>
                            <Text style={styles.aiSubtitle}>Ask anything about your health or reports</Text>
                        </View>
                        <View style={styles.aiIconCircle}>
                            <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 60 }} />

            {/* 11. Consent Modal */}
            <Modal
                visible={showConsent}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowConsent(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBox}>
                            <Ionicons name="shield-checkmark" size={40} color="#4c1d95" />
                        </View>
                        <Text style={styles.modalTitle}>Access Request</Text>
                        <Text style={styles.modalMsg}>
                            <Text style={{ fontWeight: 'bold' }}>Dr. {consentData?.doctor_name}</Text> is requesting to view your medical records for clinical consultation.
                        </Text>

                        <View style={styles.modalInfoBox}>
                            <Ionicons name="information-circle-outline" size={16} color="#64748b" />
                            <Text style={styles.modalInfoText}>This access will be logged in your history.</Text>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.grantBtn]}
                                onPress={() => handleConsentAction('approve')}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.grantBtnText}>Grant Access</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.rejectBtn]}
                                onPress={() => handleConsentAction('reject')}
                                disabled={actionLoading}
                            >
                                <Text style={styles.rejectBtnText}>Reject</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 30,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 25,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    userName: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    patientSub: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        marginTop: 2,
    },
    idBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    idText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    summaryCard: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 24,
        padding: 20,
    },
    summaryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7c3aed',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    summaryBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    summaryText: {
        color: '#fff',
        fontSize: 14,
        lineHeight: 22,
        opacity: 0.95,
    },
    lastUpdate: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        marginTop: 12,
    },
    section: {
        padding: 20,
    },
    scoreSection: {
        backgroundColor: '#fff',
        margin: 20,
        padding: 20,
        borderRadius: 24,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1e293b',
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#4c1d95',
    },
    factorTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 15,
    },
    factorTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
        marginBottom: 8,
    },
    factorText: {
        fontSize: 11,
        color: '#166534',
        marginLeft: 4,
    },
    chartSection: {
        backgroundColor: '#fff',
        padding: 20,
        marginHorizontal: 20,
        borderRadius: 24,
        marginBottom: 20,
    },
    timelineChart: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 180,
        marginTop: 20,
    },
    timelineBarGroup: {
        alignItems: 'center',
        flex: 1,
    },
    barContainer: {
        height: 150,
        width: 12,
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
        justifyContent: 'flex-end',
    },
    barFill: {
        width: '100%',
        backgroundColor: '#7c3aed',
        borderRadius: 6,
    },
    timelineYear: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 10,
    },
    conditionCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    conditionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    conditionName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
    },
    trendRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    trendItem: {
        alignItems: 'center',
    },
    trendVal: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1e293b',
    },
    trendDate: {
        fontSize: 10,
        color: '#94a3b8',
    },
    impactScroll: {
        marginTop: 10,
    },
    impactCard: {
        backgroundColor: '#fff',
        width: 140,
        padding: 16,
        borderRadius: 20,
        marginRight: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    impactMedName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
        marginTop: 8,
    },
    impactImprovement: {
        fontSize: 20,
        fontWeight: '900',
        color: '#10b981',
        marginVertical: 4,
    },
    impactLabel: {
        fontSize: 10,
        color: '#94a3b8',
    },
    alertSection: {
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fee2e2',
        marginBottom: 8,
    },
    alertText: {
        fontSize: 13,
        color: '#991b1b',
        marginLeft: 10,
        fontWeight: '600',
    },
    activityCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    activityIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    activityInfo: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
    },
    activityDate: {
        fontSize: 11,
        color: '#94a3b8',
    },
    uploadPrompt: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#cbd5e1',
    },
    uploadText: {
        marginTop: 10,
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
    aiAssistantCard: {
        margin: 20,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#4c1d95',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    aiGradient: {
        padding: 20,
    },
    aiContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    aiTextGroup: {
        flex: 1,
        marginRight: 15,
    },
    aiTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    aiSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 4,
    },
    aiIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewAll: {
        color: '#4c1d95',
        fontSize: 14,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        width: '100%',
        borderRadius: 32,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
    },
    modalIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 12,
    },
    modalMsg: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 20,
    },
    modalInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 8,
        marginBottom: 24,
    },
    modalInfoText: {
        fontSize: 12,
        color: '#64748b',
    },
    modalActions: {
        width: '100%',
        gap: 12,
    },
    modalBtn: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timelinePreviewCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 15,
        paddingLeft: 5,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 6,
        marginRight: 15,
    },
    timelineContent: {
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
    },
    timelineSummary: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    timelineTime: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    emptyTimeline: {
        padding: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        alignItems: 'center',
    },
    emptyTimelineText: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    grantBtn: {
        backgroundColor: '#4c1d95',
    },
    grantBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    rejectBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    rejectBtnText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
