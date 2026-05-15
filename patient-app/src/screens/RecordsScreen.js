import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, Image, Alert, ScrollView, Linking, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../utils/ApiService';
import { useSocket } from '../contexts/SocketContext';
import { Theme, GlobalStyles } from '../theme';
import { HapticUtils as Haptics } from '../utils/haptics';

export default function RecordsScreen({ navigation }) {
    const { lastMessage } = useSocket();
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    const fetchRecords = async () => {
        try {
            const data = await ApiService.getRecords();
            setRecords(data);
        } catch (error) {
            console.error('Fetch records error:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchRecords();
        }, [])
    );

    useEffect(() => {
        if (lastMessage?.type === 'ANALYSIS_COMPLETE') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchRecords();
        }
    }, [lastMessage]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRecords();
    };

    const openRecord = (record) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedRecord(record);
        setShowDetail(true);
    };

    const getIcon = (type) => {
        switch ((type || '').toLowerCase()) {
            case 'prescription': return 'medkit-outline';
            case 'lab': return 'flask-outline';
            case 'scan': return 'scan-outline';
            default: return 'document-text-outline';
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity 
            style={[styles.recordCard, GlobalStyles.glass]} 
            onPress={() => openRecord(item)}
            activeOpacity={0.7}
        >
            <View style={styles.recordIconBox}>
                <Ionicons name={getIcon(item.type)} size={24} color={Theme.colors.primary} />
            </View>
            <View style={styles.recordMain}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.recordTitle}>{item.record_name || 'Medical Record'}</Text>
                    {!item.needs_verification && (
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    )}
                </View>
                <Text style={styles.recordSub}>{item.hospital_name || 'Hospyn Network'}</Text>
                <Text style={styles.recordDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Ionicons name="chevron-forward" size={18} color="#475569" />
                {!item.needs_verification && (
                    <Text style={{ fontSize: 8, color: '#10B981', fontWeight: 'bold', marginTop: 4 }}>VERIFIED</Text>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={GlobalStyles.screen}>
            <LinearGradient colors={['#0F172A', '#050810']} style={styles.header}>
                <Text style={[GlobalStyles.heading, styles.headerTitle]}>CLINICAL VAULT</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => navigation.navigate('Upload')}>
                    <Ionicons name="cloud-upload" size={20} color="#fff" />
                    <Text style={styles.uploadBtnText}>UPLOAD</Text>
                </TouchableOpacity>
            </LinearGradient>

            <FlatList
                data={records}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
                ListEmptyComponent={
                    !isLoading && (
                        <View style={styles.emptyBox}>
                            <Ionicons name="documents-outline" size={60} color="#1E293B" />
                            <Text style={styles.emptyText}>Your medical vault is empty.</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Upload')}>
                                <Text style={styles.emptyBtnText}>Add First Record</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }
            />

            {/* Detail Modal */}
            <Modal visible={showDetail} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, GlobalStyles.glass]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowDetail(false)}>
                                <Ionicons name="close" size={28} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>RECORD DETAILS</Text>
                            <View style={{ width: 28 }} />
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {selectedRecord?.file_url && (
                                <View style={styles.previewBox}>
                                    <Image source={{ uri: selectedRecord.file_url }} style={styles.previewImage} resizeMode="contain" />
                                    <TouchableOpacity style={styles.fullViewBtn} onPress={() => Linking.openURL(selectedRecord.file_url)}>
                                        <Text style={styles.fullViewText}>VIEW FULL RESOLUTION</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={styles.detailsBox}>
                                <Text style={styles.label}>ANALYSIS SUMMARY</Text>
                                <Text style={styles.summaryText}>{selectedRecord?.ai_summary || 'No summary available.'}</Text>
                                
                                <View style={styles.infoRow}>
                                    <View style={styles.infoItem}>
                                        <Text style={styles.label}>FACILITY</Text>
                                        <Text style={styles.infoValue}>{selectedRecord?.hospital_name || 'N/A'}</Text>
                                    </View>
                                    <View style={styles.infoItem}>
                                        <Text style={styles.label}>DATE</Text>
                                        <Text style={styles.infoValue}>{new Date(selectedRecord?.created_at).toLocaleDateString()}</Text>
                                    </View>
                                </View>

                                {selectedRecord?.raw_text && (
                                    <View style={{ marginTop: 20 }}>
                                        <Text style={styles.label}>RAW DATA EXTRACTED</Text>
                                        <View style={styles.rawBox}>
                                            <Text style={styles.rawText}>{selectedRecord.raw_text}</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 24, letterSpacing: 2 },
    uploadBtn: { backgroundColor: Theme.colors.primary, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, py: 8, borderRadius: 12 },
    uploadBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    listContent: { padding: 24, paddingBottom: 100 },
    recordCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 16 },
    recordIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    recordMain: { flex: 1 },
    recordTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    recordSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
    recordDate: { color: Theme.colors.primary, fontSize: 10, fontWeight: 'bold', marginTop: 4 },
    emptyBox: { alignItems: 'center', py: 100 },
    emptyText: { color: '#475569', marginTop: 20, fontSize: 14 },
    emptyBtn: { marginTop: 20, borderWidth: 1, borderColor: Theme.colors.primary, px: 20, py: 10, borderRadius: 12 },
    emptyBtnText: { color: Theme.colors.primary, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
    modalContent: { height: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    modalTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
    previewBox: { width: '100%', height: 300, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, overflow: 'hidden', marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    previewImage: { width: '100%', height: '100%' },
    fullViewBtn: { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', px: 12, py: 6, borderRadius: 8 },
    fullViewText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    detailsBox: { gap: 15 },
    label: { color: '#64748B', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    summaryText: { color: '#fff', fontSize: 16, lineHeight: 24 },
    infoRow: { flexDirection: 'row', gap: 30, marginTop: 10 },
    infoItem: { flex: 1 },
    infoValue: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 4 },
    rawBox: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 16, marginTop: 8 },
    rawText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }
});
