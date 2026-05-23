import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, Image, Alert, ScrollView, Linking, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { clinicalService } from '../services/clinicalService';
import { useSocket } from '../contexts/SocketContext';
import { Theme, GlobalStyles, getTheme, subscribeToTheme } from '../theme';
import HapticUtils from '../utils/HapticUtils';

export default function RecordsScreen({ navigation }) {
    const { lastMessage } = useSocket();
    const [records, setRecords] = useState([]);
    const [visits, setVisits] = useState([]);
    const [prescriptions, setPrescriptions] = useState([]);
    const [activeTab, setActiveTab] = useState('visits'); // 'visits' | 'all_files'
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showDetail, setShowDetail] = useState(false);
    const [theme, setThemeState] = useState(getTheme());

    useEffect(() => {
        return subscribeToTheme((newTheme) => {
            setThemeState(newTheme);
        });
    }, []);

    const fetchRecords = async (signal) => {
        try {
            // 1. Fetch raw documents
            const data = await clinicalService.getRecords(signal);
            const safeData = Array.isArray(data) ? data.filter(item => item !== null && item !== undefined) : 
                             (data?.data && Array.isArray(data.data) ? data.data.filter(item => item !== null && item !== undefined) : []);
            setRecords(safeData);

            // 2. Fetch visits
            try {
                const visitsData = await clinicalService.getVisits(signal);
                setVisits(Array.isArray(visitsData) ? visitsData : []);
            } catch (err) {
                if (err.name !== 'CanceledError') console.warn('Failed to fetch visits:', err);
                setVisits([]);
            }

            // 3. Fetch prescriptions
            try {
                const prescriptionsData = await clinicalService.getPrescriptions(signal);
                setPrescriptions(Array.isArray(prescriptionsData) ? prescriptionsData : []);
            } catch (err) {
                if (err.name !== 'CanceledError') console.warn('Failed to fetch prescriptions:', err);
                setPrescriptions([]);
            }
        } catch (error) {
            if (error.name !== 'CanceledError') console.error('Fetch records error:', error);
            setRecords([]);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            const abortController = new AbortController();
            fetchRecords(abortController.signal);
            return () => abortController.abort();
        }, [])
    );

    useEffect(() => {
        if (lastMessage?.type === 'ANALYSIS_COMPLETE' || lastMessage?.type === 'LAB_RESULT_READY') {
            HapticUtils.success();
            fetchRecords();
        }
    }, [lastMessage]);

    const onRefresh = () => {
        HapticUtils.light();
        setRefreshing(true);
        fetchRecords();
    };

    const openRecord = (record) => {
        if (!record) return;
        HapticUtils.selection();
        setSelectedRecord(record);
        setShowDetail(true);
    };

    const getIcon = (type) => {
        switch ((type || '').toLowerCase()) {
            case 'prescription': return 'medkit-outline';
            case 'lab_report':
            case 'lab': return 'flask-outline';
            case 'scan': return 'scan-outline';
            default: return 'document-text-outline';
        }
    };

    const formatDate = (dateStr) => {
        try {
            if (!dateStr) return 'Recent';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'Recent';
            return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
        } catch (e) {
            return 'Recent';
        }
    };

    const formatFullDate = (dateStr) => {
        try {
            if (!dateStr) return 'N/A';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'N/A';
            return d.toLocaleDateString();
        } catch (e) {
            return 'N/A';
        }
    };

    const isAnalyzing = (item) => {
        if (!item) return false;
        return item?.raw_text === '[PIPELINE_ANALYSIS_STAGED]' || 
               item?.ai_summary === 'Chitti is decoding your clinical data...';
    };

    const getGroupedVisits = () => {
        return visits.map(visit => {
            const visitRecords = records.filter(r => r.visit_id === visit.id);
            const visitPrescriptions = prescriptions.filter(p => p.visit_id === visit.id);
            return {
                ...visit,
                records: visitRecords,
                prescriptions: visitPrescriptions
            };
        });
    };

    const renderRecordItem = ({ item, index }) => {
        const analyzing = isAnalyzing(item);
        return (
            <Animated.View entering={FadeInUp.delay(index * 100)}>
                <TouchableOpacity 
                    style={[styles.recordCard, GlobalStyles.glass]} 
                    onPress={() => {
                        if (item.type === 'prescription' && item.medications) {
                            HapticUtils.selection();
                            navigation.navigate('PrescriptionDetail', { prescription: item });
                        } else {
                            openRecord(item);
                        }
                    }}
                    activeOpacity={0.7}
                >
                    <View style={[styles.recordIconBox, { backgroundColor: analyzing ? 'rgba(124, 58, 237, 0.08)' : 'rgba(34, 211, 238, 0.05)' }]}>
                        {analyzing ? (
                            <Ionicons name="sparkles" size={24} color="#7c3aed" />
                        ) : (
                            <Ionicons name={getIcon(item.type)} size={24} color={Theme.colors.primary} />
                        )}
                    </View>
                    <View style={styles.recordMain}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.recordTitle, { color: Theme.colors.text }]} numberOfLines={1}>{item.record_name || 'Medical Record'}</Text>
                            {!item.needs_verification && !analyzing && (
                                <Ionicons name="checkmark-shield" size={14} color="#10B981" />
                            )}
                        </View>
                        <Text style={[styles.recordSub, { color: Theme.colors.textMuted }]}>{item.hospital_name || 'Hospyn Network'}</Text>
                        
                        {analyzing ? (
                            <View style={styles.analyzingBadge}>
                                <ActivityIndicator size="small" color="#7c3aed" style={{ marginRight: 6 }} />
                                <Text style={styles.analyzingText}>Chitti AI Ingesting...</Text>
                            </View>
                        ) : (
                            <Text style={[styles.recordSummaryLine, { color: Theme.colors.textMuted }]} numberOfLines={1}>
                                {item.ai_summary || 'No summary available.'}
                            </Text>
                        )}
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', minHeight: 45 }}>
                        <Text style={styles.cornerDate}>{formatDate(item.created_at)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            {!item.needs_verification && !analyzing && (
                                <Text style={{ fontSize: 8, color: '#10B981', fontWeight: 'bold' }}>VERIFIED</Text>
                            )}
                            {analyzing && (
                                <Text style={{ fontSize: 8, color: '#7c3aed', fontWeight: 'bold' }}>STAGED</Text>
                            )}
                            <Ionicons name="chevron-forward" size={18} color="#475569" />
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderVisitItem = ({ item, index }) => {
        const isActive = item.status === 'active';
        return (
            <Animated.View entering={FadeInUp.delay(index * 100)} style={[styles.visitCard, GlobalStyles.glass]}>
                {/* Visit Header */}
                <View style={styles.visitHeader}>
                    <View style={styles.visitHeaderLeft}>
                        <View style={[styles.visitIconBox, { backgroundColor: isActive ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                            <Ionicons 
                                name={isActive ? "time" : "checkmark-circle"} 
                                size={22} 
                                color={isActive ? "#F59E0B" : "#10B981"} 
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.visitHospital, { color: Theme.colors.text }]} numberOfLines={1}>
                                {item.hospital_name || 'Hospyn Medical Center'}
                            </Text>
                            <Text style={[styles.visitReason, { color: Theme.colors.textMuted }]} numberOfLines={1}>
                                {item.visit_reason || 'General Consultation'}
                            </Text>
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.visitDate}>{formatDate(item.check_in_time)}</Text>
                        {isActive && item.queue_token && (
                            <View style={styles.tokenBadge}>
                                <Text style={styles.tokenText}>TOKEN {item.queue_token}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Visit Contents */}
                <View style={styles.visitBody}>
                    {/* Render Prescriptions */}
                    {item.prescriptions.map((presc) => (
                        <TouchableOpacity 
                            key={presc.id} 
                            style={styles.nestedRow} 
                            onPress={() => {
                                HapticUtils.selection();
                                navigation.navigate('PrescriptionDetail', { prescription: presc });
                            }}
                        >
                            <View style={[styles.nestedIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                                <Ionicons name="medical" size={16} color="#6366F1" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.nestedTitle, { color: Theme.colors.text }]}>Digital Prescription</Text>
                                <Text style={[styles.nestedSub, { color: Theme.colors.textMuted }]} numberOfLines={1}>
                                    {presc.diagnosis || 'Clinical Prescription'} • {presc.medications.length} meds
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#475569" />
                        </TouchableOpacity>
                    ))}

                    {/* Render Records (Lab Reports/Scans) */}
                    {item.records.map((rec) => {
                        const analyzing = isAnalyzing(rec);
                        return (
                            <TouchableOpacity 
                                key={rec.id} 
                                style={styles.nestedRow} 
                                onPress={() => openRecord(rec)}
                            >
                                <View style={[styles.nestedIconBox, { backgroundColor: rec.type === 'lab_report' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(34, 211, 238, 0.1)' }]}>
                                    <Ionicons 
                                        name={getIcon(rec.type)} 
                                        size={16} 
                                        color={rec.type === 'lab_report' ? "#10B981" : Theme.colors.primary} 
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={[styles.nestedTitle, { color: Theme.colors.text }]} numberOfLines={1}>
                                            {rec.record_name || 'Medical Document'}
                                        </Text>
                                        {analyzing && (
                                            <ActivityIndicator size="small" color="#7c3aed" />
                                        )}
                                    </View>
                                    <Text style={[styles.nestedSub, { color: Theme.colors.textMuted }]} numberOfLines={1}>
                                        {analyzing ? "Chitti AI processing..." : (rec.ai_summary || 'Ingested report details.')}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#475569" />
                            </TouchableOpacity>
                        );
                    })}

                    {/* Fallback if visit is empty */}
                    {item.prescriptions.length === 0 && item.records.length === 0 && (
                        <View style={styles.emptyVisitState}>
                            <Ionicons 
                                name={isActive ? "pulse-outline" : "ellipse-outline"} 
                                size={18} 
                                color={isActive ? "#F59E0B" : "#475569"} 
                                style={{ marginRight: 8 }}
                            />
                            <Text style={[styles.emptyVisitText, { color: Theme.colors.textMuted }]}>
                                {isActive 
                                    ? "Waiting for doctor consultation & diagnostics..." 
                                    : "No digital records linked to this consultation."}
                            </Text>
                        </View>
                    )}
                </View>
            </Animated.View>
        );
    };
    
    const renderProactiveChittiCard = () => {
        const grouped = getGroupedVisits();
        if (grouped.length === 0) return null;
        
        const latestVisit = grouped[0];
        
        // Dynamic analysis points based on prescription or diagnosis
        const diagnosis = latestVisit.prescriptions?.[0]?.diagnosis || latestVisit.visit_reason || 'General Consultation';
        const hasMedications = latestVisit.prescriptions?.[0]?.items?.length > 0;
        
        const initialQuery = `Hi Chitti, explain my recent visit to ${latestVisit.hospital_name || 'clinic'} for ${latestVisit.visit_reason || 'consultation'} in detail. Can you tell me what medications I have, their dosages, and what precautions I should take?`;
        
        return (
            <Animated.View entering={FadeInUp.delay(50)} style={styles.proactiveCard}>
                <LinearGradient 
                    colors={['rgba(13, 148, 136, 0.12)', 'rgba(13, 148, 136, 0.02)']} 
                    style={styles.proactiveGradient}
                >
                    <View style={styles.proactiveHeader}>
                        <View style={styles.proactiveTitleRow}>
                            <View style={styles.proactivePulseContainer}>
                                <Image source={require('../../assets/chitti_avatar.png')} style={styles.proactiveAvatar} />
                                <View style={styles.pulseRing} />
                            </View>
                            <View>
                                <Text style={styles.proactiveTag}>CHITTI PROACTIVE GUIDANCE</Text>
                                <Text style={styles.proactiveTitle}>Clinical Visit Analyzed</Text>
                            </View>
                        </View>
                        <Ionicons name="sparkles" size={18} color="#0D9488" />
                    </View>
                    
                    <Text style={styles.proactiveIntro}>
                        I have decrypted and analyzed your check-in records at <Text style={{fontWeight: 'bold', color: '#fff'}}>{latestVisit.hospital_name}</Text>. Here is what you should know:
                    </Text>
                    
                    <View style={styles.proactivePointRow}>
                        <View style={styles.bulletDot} />
                        <Text style={styles.proactivePointText}>
                            <Text style={{fontWeight: 'bold', color: '#0D9488'}}>Diagnosis Summary: </Text>
                            Active tracking for <Text style={{color: '#fff'}}>{diagnosis}</Text>.
                        </Text>
                    </View>
                    
                    {hasMedications && (
                        <View style={styles.proactivePointRow}>
                            <View style={styles.bulletDot} />
                            <Text style={styles.proactivePointText}>
                                <Text style={{fontWeight: 'bold', color: '#0D9488'}}>Medication Plan: </Text>
                                {latestVisit.prescriptions[0].items.map(item => `${item.name} (${item.dosage || 'as prescribed'})`).join(', ')}.
                            </Text>
                        </View>
                    )}
                    
                    <View style={styles.proactivePointRow}>
                        <View style={styles.bulletDot} />
                        <Text style={styles.proactivePointText}>
                            <Text style={{fontWeight: 'bold', color: '#0D9488'}}>Advisory: </Text>
                            Keep hydrated, follow regular dosage schedules, and check if lab attachments complete.
                        </Text>
                    </View>
                    
                    <TouchableOpacity 
                        style={styles.proactiveActionBtn}
                        onPress={() => {
                            HapticUtils.selection();
                            navigation.navigate('Chitti AI', { initialMessage: initialQuery });
                        }}
                    >
                        <Text style={styles.proactiveActionText}>DISCUSS VISIT WITH CHITTI</Text>
                        <Ionicons name="chatbubble-ellipses-outline" size={15} color="#0D9488" style={{marginLeft: 6}} />
                    </TouchableOpacity>
                </LinearGradient>
            </Animated.View>
        );
    };

    const isLightTheme = Theme.colors.primary === '#7C3AED';
    const bgColors = isLightTheme 
        ? ['#F8F7FF', '#EEEBFF'] 
        : ['#090D1A', '#020408'];

    const docUrl = selectedRecord?.secure_url || selectedRecord?.file_url;

    return (
        <LinearGradient colors={bgColors} style={{ flex: 1 }}>
            <LinearGradient colors={Theme.colors.primary === '#7C3AED' ? ['#7C3AED', '#4F46E5'] : ['#0F172A', '#050810']} style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>CLINICAL VAULT</Text>
                    <Text style={[styles.headerSub, { color: 'rgba(255, 255, 255, 0.7)' }]}>End-to-End Encrypted Records</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => { HapticUtils.light(); navigation.navigate('Prescriptions'); }}>
                        <Ionicons name="medkit" size={18} color="#fff" />
                        <Text style={styles.uploadBtnText}>RX</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => { HapticUtils.light(); navigation.navigate('Upload'); }}>
                        <Ionicons name="cloud-upload" size={18} color="#fff" />
                        <Text style={styles.uploadBtnText}>VAULT</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* SEGMENTED TAB SELECTOR */}
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[
                        styles.tabButton, 
                        activeTab === 'visits' && [styles.tabButtonActive, { borderBottomColor: Theme.colors.primary }]
                    ]}
                    onPress={() => { HapticUtils.light(); setActiveTab('visits'); }}
                >
                    <Ionicons name="calendar-outline" size={16} color={activeTab === 'visits' ? Theme.colors.primary : '#64748B'} />
                    <Text style={[
                        styles.tabText, 
                        { color: activeTab === 'visits' ? Theme.colors.text : '#64748B' }
                    ]}>VISITS</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[
                        styles.tabButton, 
                        activeTab === 'all_files' && [styles.tabButtonActive, { borderBottomColor: Theme.colors.primary }]
                    ]}
                    onPress={() => { HapticUtils.light(); setActiveTab('all_files'); }}
                >
                    <Ionicons name="documents-outline" size={16} color={activeTab === 'all_files' ? Theme.colors.primary : '#64748B'} />
                    <Text style={[
                        styles.tabText, 
                        { color: activeTab === 'all_files' ? Theme.colors.text : '#64748B' }
                    ]}>ALL DOCUMENTS</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={Theme.colors.primary} size="large" />
                    <Text style={[styles.loaderText, { color: Theme.colors.textMuted }]}>Syncing Clinical Ledger...</Text>
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'visits' ? getGroupedVisits() : [...records, ...prescriptions.map(p => ({
                        ...p, 
                        type: 'prescription', 
                        record_name: 'Digital Prescription', 
                        ai_summary: p.diagnosis || 'Clinical Prescription'
                    }))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))}
                    renderItem={activeTab === 'visits' ? renderVisitItem : renderRecordItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={activeTab === 'visits' ? renderProactiveChittiCard : null}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
                    }
                    ListEmptyComponent={
                        <Animated.View entering={FadeIn} style={styles.emptyContainer}>
                            <View style={styles.chittiBox}>
                                <Ionicons name="sparkles" size={40} color={Theme.colors.primary} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: Theme.colors.text }]}>
                                {activeTab === 'visits' ? "No Visits Yet" : "Vault is Empty"}
                            </Text>
                            <Text style={[styles.emptySub, { color: Theme.colors.textMuted }]}>
                                {activeTab === 'visits' 
                                    ? "Scan a Hospyn QR code at any hospital or clinic to open a new digital check-in."
                                    : '"Hello! I am Chitti. Your clinical vault is ready for ingestion. Upload your prescriptions or lab reports to begin my neural analysis."'}
                            </Text>
                            {activeTab === 'all_files' && (
                                <TouchableOpacity style={[styles.emptyAction, { backgroundColor: Theme.colors.primary, shadowColor: Theme.colors.primary }]} onPress={() => navigation.navigate('Upload')}>
                                    <Text style={styles.emptyActionText}>DIGITALIZE FIRST RECORD</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    }
                />
            )}

            <Modal visible={showDetail} animationType="slide" transparent={true}>
                <View style={[styles.modalOverlay, { backgroundColor: Theme.colors.primary === '#7C3AED' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.9)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: Theme.colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: Theme.colors.text }]}>Record Detail</Text>
                            <TouchableOpacity onPress={() => setShowDetail(false)}>
                                <Ionicons name="close" size={28} color={Theme.colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {docUrl && (
                                <View style={styles.previewBox}>
                                    <Image source={{ uri: docUrl }} style={styles.previewImage} resizeMode="contain" />
                                    <View style={{ position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            style={[styles.fullViewBtn, { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }]}
                                            onPress={() => Linking.openURL(docUrl)}
                                        >
                                            <Text style={styles.fullViewText}>VIEW FULL</Text>
                                        </TouchableOpacity>
                                        {!isAnalyzing(selectedRecord) && (
                                            <TouchableOpacity 
                                                style={[styles.fullViewBtn, { backgroundColor: Theme.colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }]} 
                                                onPress={async () => {
                                                    const { SecurityService } = require('../utils/SecurityService');
                                                    if (await SecurityService.confirmSensitiveAction('share your medical data')) {
                                                        Alert.alert("Success", "Secure sharing link generated and ready.");
                                                    }
                                                }}
                                            >
                                                <Text style={styles.fullViewText}>SHARE</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            )}

                            <View style={styles.detailsBox}>
                                <Text style={styles.label}>ANALYSIS STATUS</Text>
                                {isAnalyzing(selectedRecord) ? (
                                    <View style={styles.modalAnalyzingCard}>
                                        <ActivityIndicator size="large" color="#7c3aed" style={{ marginBottom: 12 }} />
                                        <Text style={[styles.modalAnalyzingTitle, { color: Theme.colors.text }]}>Chitti AI is Deciphering...</Text>
                                        <Text style={[styles.modalAnalyzingSub, { color: Theme.colors.textMuted }]}>
                                            Chitti AI's neural vision models are actively parsing this prescription/lab report. We are extracting medications, dosages, clinical findings, and medical terms.
                                            
                                            This vault detail will automatically update with an easy-to-read summary once ingestion is finished. Pull down to refresh your ledger!
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        <Text style={[styles.summaryText, { color: Theme.colors.text }]}>{selectedRecord?.ai_summary || 'No summary available.'}</Text>
                                        
                                        <View style={styles.infoRow}>
                                            <View style={styles.infoItem}>
                                                <Text style={styles.label}>FACILITY</Text>
                                                <Text style={[styles.infoValue, { color: Theme.colors.text }]}>{selectedRecord?.hospital_name || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.infoItem}>
                                                <Text style={styles.label}>DATE</Text>
                                                <Text style={[styles.infoValue, { color: Theme.colors.text }]}>{formatFullDate(selectedRecord?.created_at)}</Text>
                                            </View>
                                        </View>

                                        {selectedRecord?.raw_text && selectedRecord.raw_text !== '[PIPELINE_ANALYSIS_STAGED]' && (
                                            <View style={{ marginTop: 20 }}>
                                                <Text style={styles.label}>RAW DATA EXTRACTED</Text>
                                                <View style={[styles.rawBox, { backgroundColor: Theme.colors.primary === '#7C3AED' ? '#F1F5F9' : 'rgba(0,0,0,0.3)', borderColor: Theme.colors.border, borderWidth: 1 }]}>
                                                    <Text style={[styles.rawText, { color: Theme.colors.text }]}>{selectedRecord.raw_text}</Text>
                                                </View>
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 24, letterSpacing: 2, fontWeight: 'bold' },
    headerSub: { fontSize: 12, marginTop: 4 },
    uploadBtn: { backgroundColor: 'rgba(255, 255, 255, 0.15)', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    uploadBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    listContent: { padding: 24, paddingBottom: 140 },
    recordCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 16 },
    recordIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    recordMain: { flex: 1 },
    recordTitle: { fontSize: 16, fontWeight: 'bold' },
    recordSub: { fontSize: 12, marginTop: 2 },
    recordDate: { fontSize: 10, fontWeight: 'bold', marginTop: 4 },
    cornerDate: { color: '#64748B', fontSize: 10, fontWeight: '700' },
    recordSummaryLine: { fontSize: 12, marginTop: 4 },
    analyzingBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    analyzingText: { color: '#7c3aed', fontSize: 11, fontWeight: '700' },
    modalAnalyzingCard: {
        backgroundColor: 'rgba(124, 58, 237, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.15)',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    modalAnalyzingTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginVertical: 10,
    },
    modalAnalyzingSub: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 18,
    },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 24 },
    chittiBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)' },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 16, fontStyle: 'italic' },
    emptyAction: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    emptyActionText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { height: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    modalTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 2 },
    previewBox: { width: '100%', height: 300, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, overflow: 'hidden', marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    previewImage: { width: '100%', height: '100%' },
    fullViewBtn: { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    fullViewText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    detailsBox: { gap: 15 },
    label: { color: '#64748B', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    summaryText: { fontSize: 16, lineHeight: 24 },
    infoRow: { flexDirection: 'row', gap: 30, marginTop: 10 },
    infoItem: { flex: 1 },
    infoValue: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },
    rawBox: { padding: 16, borderRadius: 16, marginTop: 8 },
    rawText: { fontSize: 12, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { fontSize: 14, marginTop: 12, fontWeight: '600' },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        marginBottom: 10
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent'
    },
    tabButtonActive: {
        borderBottomColor: '#6366F1'
    },
    tabText: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1
    },
    visitCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(255,255,255,0.02)'
    },
    visitHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        paddingBottom: 15,
        marginBottom: 15
    },
    visitHeaderLeft: {
        flexDirection: 'row',
        gap: 12,
        flex: 1,
        alignItems: 'center'
    },
    visitIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center'
    },
    visitHospital: {
        fontSize: 16,
        fontWeight: 'bold'
    },
    visitReason: {
        fontSize: 12,
        marginTop: 2
    },
    visitDate: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '700'
    },
    tokenBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginTop: 6,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)'
    },
    tokenText: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '900'
    },
    visitBody: {
        gap: 12
    },
    nestedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 16,
        gap: 12
    },
    nestedIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    nestedTitle: {
        fontSize: 13,
        fontWeight: 'bold'
    },
    nestedSub: {
        fontSize: 11,
        marginTop: 2
    },
    emptyVisitState: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.01)',
        borderRadius: 12,
        justifyContent: 'center'
    },
    emptyVisitText: {
        fontSize: 11,
        fontStyle: 'italic',
        textAlign: 'center'
    },
    proactiveCard: {
        marginBottom: 20,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(13, 148, 136, 0.2)',
    },
    proactiveGradient: {
        padding: 20,
    },
    proactiveHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    proactiveTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    proactivePulseContainer: {
        position: 'relative',
        width: 36,
        height: 36,
    },
    proactiveAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(13, 148, 136, 0.3)',
    },
    pulseRing: {
        position: 'absolute',
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(13, 148, 136, 0.4)',
        top: 0,
        left: 0,
    },
    proactiveTag: {
        fontSize: 8,
        color: '#0D9488',
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    proactiveTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 2,
    },
    proactiveIntro: {
        fontSize: 12,
        color: '#94A3B8',
        lineHeight: 18,
        marginBottom: 12,
    },
    proactivePointRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    bulletDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#0D9488',
        marginTop: 6,
    },
    proactivePointText: {
        flex: 1,
        fontSize: 12,
        color: '#94A3B8',
        lineHeight: 16,
    },
    proactiveActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(13, 148, 136, 0.08)',
        borderColor: 'rgba(13, 148, 136, 0.2)',
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 12,
        marginTop: 15,
    },
    proactiveActionText: {
        color: '#0D9488',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1.5,
    }
});
