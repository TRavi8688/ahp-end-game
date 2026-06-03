import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Modal, Image, Alert, ScrollView, Linking, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { SecurityUtils } from '../utils/security';
import { Theme, GlobalStyles } from '../theme';
import * as Haptics from 'expo-haptics';

export default function MyRecordsScreen({ navigation }) {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [analysisData, setAnalysisData] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    // --- NEW: Record Detail Viewer ---
    const [showDetail, setShowDetail] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);

    const fetchRecords = async () => {
        try {
            const token = await SecurityUtils.getToken();
            const response = await axios.get(`${API_BASE_URL}/patient/records`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Hidden records are fine in AsyncStorage as they aren't sensitive auth data
            const hiddenIdsStr = await AsyncStorage.getItem('hidden_records');
            const hiddenIds = hiddenIdsStr ? JSON.parse(hiddenIdsStr) : [];
            const visibleRecords = response.data.filter(r => !hiddenIds.includes(r.id));

            setRecords(visibleRecords);
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchRecords();
        }, [])
    );

    const openRecord = (record) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedRecord(record);
        setShowDetail(true);
    };

    const handleUpload = async (type) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            let result;
            if (type === 'camera') {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) return Alert.alert('Permission Denied', 'Camera access is required.');
                result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
            } else if (type === 'gallery') {
                result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
            } else {
                result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
            }

            if (result.canceled || !result.assets) return;

            const file = result.assets[0];
            processFile(file);
        } catch (error) {
            Alert.alert('Upload Error', 'Failed to select file.');
        }
    };

    const processFile = async (file) => {
        setIsProcessing(true);
        setUploadProgress(10);

        try {
            const token = await SecurityUtils.getToken();
            const formData = new FormData();

            const fileUri = file.uri;
            const fileName = file.name || `upload_${Date.now()}.jpg`;
            const fileType = file.mimeType || 'image/jpeg';

            let uploadResponse;

            if (Platform.OS === 'web') {
                // On web: convert data URI / blob URI to a real File object
                const fetchRes = await fetch(fileUri);
                const blob = await fetchRes.blob();
                const realFile = new File([blob], fileName, { type: fileType });
                formData.append('file', realFile);

                setUploadProgress(30);

                // Use native fetch (NOT axios) — axios breaks multipart blob uploads on web
                const rawResp = await fetch(`${API_BASE_URL}/patient/upload-report`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData,
                });
                uploadResponse = { data: await rawResp.json(), status: rawResp.status };
                if (!rawResp.ok) throw new Error(uploadResponse.data?.detail || 'Upload failed');
            } else {
                // On native iOS/Android: axios handles {uri, name, type} correctly
                formData.append('file', { uri: fileUri, name: fileName, type: fileType });
                setUploadProgress(30);
                uploadResponse = await axios.post(`${API_BASE_URL}/patient/upload-report`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': `Bearer ${token}`
                    }
                });
            }

            setUploadProgress(100);
            if (uploadResponse.data.status === 'success') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setAnalysisData(uploadResponse.data);
                setShowAnalysis(true);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Analysis Failed', uploadResponse.data.message || 'Chitti could not read this document.');
            }
        } catch (error) {
            console.error('Upload error:', error);
            Alert.alert('Network Error', 'Could not reach Chitti. Please check your connection.');
        } finally {
            setIsProcessing(false);
            setUploadProgress(0);
            fetchRecords();
        }
    };

    const confirmSave = async (shouldUpdateProfile) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const token = await SecurityUtils.getToken();
            await axios.post(`${API_BASE_URL}/patient/confirm-and-save-report`, {
                analysis: {
                    structured_data: analysisData.extracted_data,
                    summary: analysisData.summary,
                    doctor_summary: analysisData.doctor_summary || "",
                    raw_text: analysisData.visual_findings || ""
                },
                s3_url: analysisData.url,
                type: analysisData.type,
                update_profile: shouldUpdateProfile
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setShowAnalysis(false);
            Alert.alert('Success', shouldUpdateProfile ? 'Record added to your clinical profile!' : 'Record stored safely in history.');
            fetchRecords();
        } catch (error) {
            Alert.alert('Error', 'Failed to confirm record.');
        }
    };

    // Parse ai_extracted field (JSON string or object)
    const parseExtracted = (record) => {
        if (!record) return { conditions: [], medications: [] };
        try {
            const raw = record.ai_extracted;
            if (!raw) return { conditions: [], medications: [] };
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return {
                conditions: parsed.conditions || [],
                medications: parsed.medications || [],
                hospital: parsed.hospital_details || {}
            };
        } catch {
            return { conditions: [], medications: [] };
        }
    };

    const isImageUrl = (url) => {
        if (!url) return false;
        const lower = (url || '').toLowerCase();
        return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp');
    };

    const openFileInBrowser = (url) => {
        if (url && !url.startsWith('local://') && !url.startsWith('simulated')) {
            Linking.openURL(url);
        } else {
            Alert.alert('File not available', 'This file was stored locally and cannot be previewed.');
        }
    };

    const getRecordTypeIcon = (type) => {
        switch ((type || '').toLowerCase()) {
            case 'prescription': return 'medical';
            case 'lab': return 'flask';
            case 'xray': case 'scan': return 'scan';
            default: return 'document-text';
        }
    };

    const hideRecord = async (recordId) => {
        const updateHiddenRecords = async () => {
            try {
                const hiddenIdsStr = await AsyncStorage.getItem('hidden_records');
                const hiddenIds = hiddenIdsStr ? JSON.parse(hiddenIdsStr) : [];
                if (!hiddenIds.includes(recordId)) {
                    hiddenIds.push(recordId);
                    await AsyncStorage.setItem('hidden_records', JSON.stringify(hiddenIds));
                }
                setRecords(prev => prev.filter(r => r.id !== recordId));
            } catch (e) {
                console.error("Error saving hidden record:", e);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('This record will be hidden from your view. Do you want to continue?')) {
                updateHiddenRecords();
            }
        } else {
            Alert.alert(
                'Hide Record',
                'This record will be hidden from your view. It will still be safely stored in the system. Do you want to continue?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Hide', style: 'destructive', onPress: updateHiddenRecords
                    }
                ]
            );
        }
    };

    const renderRecordItem = ({ item }) => (
        <TouchableOpacity style={styles.recordCard} onPress={() => openRecord(item)} activeOpacity={0.85}>
            <LinearGradient colors={['#f5f3ff', '#ede9fe']} style={styles.recordIcon}>
                <Ionicons
                    name={getRecordTypeIcon(item.type)}
                    size={24}
                    color="#4c1d95"
                />
            </LinearGradient>
            <View style={styles.recordContent}>
                <Text style={styles.recordTitle}>{item.title || (item.type === 'prescription' ? 'Prescription' : 'Medical Record')}</Text>
                <Text style={styles.recordSummary} numberOfLines={2}>{item.ai_summary || 'Tap to view details'}</Text>
                <Text style={styles.recordDate}>{new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            </View>
            <TouchableOpacity
                style={styles.hideBtn}
                onPress={(e) => { e.stopPropagation(); hideRecord(item.id); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
            <View style={styles.viewButton}>
                <Ionicons name="chevron-forward" size={20} color="#7c3aed" />
            </View>
        </TouchableOpacity>
    );

    const DetailModal = () => {
        if (!selectedRecord) return null;
        const extracted = parseExtracted(selectedRecord);
        const fileUrl = selectedRecord.file_url;
        const isImage = isImageUrl(fileUrl);
        const hasRealFile = fileUrl && !fileUrl.startsWith('local://') && !fileUrl.startsWith('simulated');

        return (
            <Modal visible={showDetail} animationType="slide" onRequestClose={() => setShowDetail(false)}>
                <View style={styles.detailContainer}>
                    {/* Header */}
                    <LinearGradient colors={['#4c1d95', '#7c3aed']} style={styles.detailHeader}>
                        <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.detailHeaderText}>
                            <Text style={styles.detailHeaderTitle}>
                                {selectedRecord.type === 'prescription' ? '💊 Prescription' : '📄 Medical Record'}
                            </Text>
                            <Text style={styles.detailHeaderDate}>
                                {new Date(selectedRecord.created_at).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </Text>
                        </View>
                    </LinearGradient>

                    <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>

                        {/* File Preview */}
                        {hasRealFile ? (
                            <View style={styles.filePreviewBox}>
                                {isImage ? (
                                    <>
                                        <Image
                                            source={{ uri: fileUrl }}
                                            style={styles.previewImage}
                                            resizeMode="contain"
                                        />
                                        <TouchableOpacity style={styles.openFileBtn} onPress={() => openFileInBrowser(fileUrl)}>
                                            <Ionicons name="open-outline" size={16} color="#4c1d95" />
                                            <Text style={styles.openFileBtnText}>Open Full Image</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity style={styles.pdfPreviewBtn} onPress={() => openFileInBrowser(fileUrl)}>
                                        <Ionicons name="document-attach" size={40} color="#4c1d95" />
                                        <Text style={styles.pdfPreviewTitle}>View Document</Text>
                                        <Text style={styles.pdfPreviewSub}>Tap to open in browser</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <View style={styles.noFileBox}>
                                <Ionicons name="cloud-offline-outline" size={40} color="#ccc" />
                                <Text style={styles.noFileText}>File preview not available</Text>
                                <Text style={styles.noFileSubText}>The original document was not stored online yet.</Text>
                            </View>
                        )}

                        {/* Chitti Summary */}
                        {selectedRecord.ai_summary ? (
                            <View style={styles.summaryCard}>
                                <View style={styles.summaryHeader}>
                                    <Text style={{ fontSize: 20 }}>🤖</Text>
                                    <Text style={styles.summaryTitle}>Chitti's Summary</Text>
                                </View>
                                <Text style={styles.summaryText}>{selectedRecord.ai_summary}</Text>
                            </View>
                        ) : null}

                        {/* Conditions */}
                        {extracted.conditions.length > 0 && (
                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionLabel}>🩺 CONDITIONS FOUND</Text>
                                {extracted.conditions.map((c, i) => (
                                    <View key={i} style={styles.itemRow}>
                                        <View style={[styles.dot, { backgroundColor: '#dc2626' }]} />
                                        <Text style={styles.itemText}>
                                            {typeof c === 'string' ? c : c.name || JSON.stringify(c)}
                                            {c.notes ? <Text style={styles.itemNotes}> — {c.notes}</Text> : null}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Medications */}
                        {extracted.medications.length > 0 && (
                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionLabel}>💊 MEDICATIONS</Text>
                                {extracted.medications.map((m, i) => (
                                    <View key={i} style={styles.itemRow}>
                                        <View style={[styles.dot, { backgroundColor: '#059669' }]} />
                                        <Text style={styles.itemText}>
                                            {typeof m === 'string' ? m : `${m.name || ''}${m.dosage ? ' – ' + m.dosage : ''}${m.frequency ? ', ' + m.frequency : ''}`}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Hospital details */}
                        {extracted.hospital && extracted.hospital.name && (
                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionLabel}>🏥 HOSPITAL / CLINIC</Text>
                                <Text style={styles.itemText}>{extracted.hospital.name}</Text>
                                {extracted.hospital.address ? <Text style={styles.itemNotes}>{extracted.hospital.address}</Text> : null}
                                {extracted.hospital.contact ? <Text style={styles.itemNotes}>📞 {extracted.hospital.contact}</Text> : null}
                            </View>
                        )}

                        {/* Raw text */}
                        {selectedRecord.raw_text ? (
                            <View style={[styles.sectionCard, { marginBottom: 40 }]}>
                                <Text style={styles.sectionLabel}>📝 ORIGINAL TEXT FROM DOCUMENT</Text>
                                <Text style={styles.rawText}>{selectedRecord.raw_text}</Text>
                            </View>
                        ) : <View style={{ height: 40 }} />}

                    </ScrollView>
                </View>
            </Modal>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={records}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderRecordItem}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    !isLoading && (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="documents-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyText}>No medical records yet.</Text>
                            <Text style={styles.emptySubtext}>Upload your first report to start your history.</Text>
                        </View>
                    )
                }
                ListHeaderComponent={
                    <View style={styles.uploadSection}>
                        <Text style={styles.sectionTitle}>Add New Record</Text>
                        <View style={styles.uploadGrid}>
                            <TouchableOpacity style={styles.uploadBox} onPress={() => handleUpload('camera')}>
                                <Ionicons name="camera" size={32} color="#4c1d95" />
                                <Text style={styles.uploadLabel}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.uploadBox} onPress={() => handleUpload('gallery')}>
                                <Ionicons name="images" size={32} color="#4c1d95" />
                                <Text style={styles.uploadLabel}>Gallery</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.uploadBox} onPress={() => handleUpload('file')}>
                                <Ionicons name="document-attach" size={32} color="#4c1d95" />
                                <Text style={styles.uploadLabel}>PDF/File</Text>
                            </TouchableOpacity>
                        </View>
                        {records.length > 0 && (
                            <Text style={styles.recordsCountLabel}>{records.length} record{records.length !== 1 ? 's' : ''} stored</Text>
                        )}
                    </View>
                }
            />

            {/* NEW: Record Detail Viewer */}
            <DetailModal />

            {/* Analysis Modal (after upload) */}
            <Modal visible={showAnalysis} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <LinearGradient colors={['#4c1d95', '#7c3aed']} style={styles.modalHeader}>
                            <Ionicons name="sparkles" size={24} color="#fff" style={{ marginRight: 10 }} />
                            <Text style={styles.modalHeaderTitle}>Chitti's Analysis</Text>
                            <TouchableOpacity onPress={() => setShowAnalysis(false)} style={styles.closeModal}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView style={styles.modalContent}>
                            <View style={styles.chittiBox}>
                                <View style={styles.chittiAvatar}>
                                    <Text style={{ fontSize: 20 }}>🤖</Text>
                                </View>
                                <View style={styles.chittiBubble}>
                                    <Text style={styles.chittiText}>{analysisData?.summary}</Text>
                                </View>
                            </View>

                            <Text style={styles.detailLabel}>EXTRACTED INFO:</Text>
                            <View style={styles.entitiesBox}>
                                {analysisData?.extracted_data?.conditions?.map((c, i) => (
                                    <View key={i} style={styles.entityTag}><Text style={styles.entityTagText}>🤒 {c.name || c}</Text></View>
                                ))}
                                {analysisData?.extracted_data?.medications?.map((m, i) => (
                                    <View key={i} style={[styles.entityTag, { backgroundColor: '#ecfdf5' }]}><Text style={[styles.entityTagText, { color: '#059669' }]}>💊 {m.name || m}</Text></View>
                                ))}
                            </View>

                            <View style={styles.savePromptBox}>
                                <Text style={styles.savePromptTitle}>Add to Clinical Profile?</Text>
                                <Text style={styles.savePromptText}>
                                    Checking "Yes" will add these conditions and medicines to your main health dashboard for doctors to see.
                                </Text>

                                <View style={styles.buttonRow}>
                                    <TouchableOpacity
                                        style={[styles.saveButton, { backgroundColor: '#eee' }]}
                                        onPress={() => confirmSave(false)}
                                    >
                                        <Text style={[styles.saveButtonText, { color: '#666' }]}>Just store record</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.saveButton}
                                        onPress={() => confirmSave(true)}
                                    >
                                        <Text style={styles.saveButtonText}>Yes, Save to Profile</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Processing Loader */}
            <Modal visible={isProcessing} transparent>
                <View style={styles.loaderOverlay}>
                    <View style={styles.loaderBox}>
                        <ActivityIndicator size="large" color="#4c1d95" />
                        <Text style={styles.loaderText}>Chitti is reading your report...</Text>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f7ff',
    },
    listContainer: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 15,
    },
    uploadGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    uploadBox: {
        flex: 1,
        backgroundColor: '#f5f3ff',
        borderRadius: 15,
        padding: 15,
        alignItems: 'center',
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: '#e9d5ff',
        borderStyle: 'dashed',
    },
    uploadLabel: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#4c1d95',
    },
    recordsCountLabel: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'right',
        marginBottom: 12,
        marginTop: 4,
    },
    uploadSection: {
        marginBottom: 10,
    },
    recordCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 15,
        marginBottom: 12,
        elevation: 3,
        shadowColor: '#7c3aed',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    recordIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    recordContent: {
        flex: 1,
    },
    recordTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 3,
    },
    recordSummary: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
        lineHeight: 16,
    },
    recordDate: {
        fontSize: 10,
        color: '#9ca3af',
        fontWeight: '600',
    },
    hideBtn: {
        padding: 8,
        marginRight: 4,
    },
    viewButton: {
        padding: 5,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#9ca3af',
        marginTop: 15,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#ccc',
        textAlign: 'center',
        marginTop: 5,
    },

    // ---- Detail Modal ----
    detailContainer: {
        flex: 1,
        backgroundColor: '#f8f7ff',
    },
    detailHeader: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        marginRight: 15,
        padding: 4,
    },
    detailHeaderText: {
        flex: 1,
    },
    detailHeaderTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    detailHeaderDate: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        marginTop: 2,
    },
    detailScroll: {
        flex: 1,
        padding: 20,
    },
    filePreviewBox: {
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    previewImage: {
        width: '100%',
        height: 280,
        backgroundColor: '#f3f4f6',
    },
    openFileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderTopWidth: 1,
        borderColor: '#eee',
        gap: 8,
    },
    openFileBtnText: {
        color: '#4c1d95',
        fontWeight: '700',
        fontSize: 13,
    },
    pdfPreviewBtn: {
        alignItems: 'center',
        padding: 40,
        gap: 8,
    },
    pdfPreviewTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4c1d95',
    },
    pdfPreviewSub: {
        fontSize: 12,
        color: '#9ca3af',
    },
    noFileBox: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 40,
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    noFileText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#9ca3af',
    },
    noFileSubText: {
        fontSize: 12,
        color: '#d1d5db',
        textAlign: 'center',
    },
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#4c1d95',
        letterSpacing: 0.5,
    },
    summaryText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 22,
        fontStyle: 'italic',
    },
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: '#9ca3af',
        letterSpacing: 1.5,
        marginBottom: 14,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
        gap: 10,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 5,
    },
    itemText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
        lineHeight: 20,
    },
    itemNotes: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '400',
    },
    rawText: {
        fontSize: 12,
        color: '#6b7280',
        lineHeight: 20,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    },

    // ---- Analysis Modal (post-upload) ----
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        height: '85%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: 30,
    },
    modalHeaderTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    closeModal: {
        padding: 5,
    },
    modalContent: {
        padding: 20,
    },
    chittiBox: {
        flexDirection: 'row',
        marginBottom: 25,
    },
    chittiAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    chittiBubble: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        borderRadius: 15,
        borderTopLeftRadius: 0,
        padding: 15,
    },
    chittiText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        fontStyle: 'italic',
    },
    detailLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: '#9ca3af',
        marginBottom: 10,
        letterSpacing: 1,
    },
    entitiesBox: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 25,
    },
    entityTag: {
        backgroundColor: '#eff6ff',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    entityTagText: {
        fontSize: 12,
        color: '#1d4ed8',
        fontWeight: 'bold',
    },
    savePromptBox: {
        borderTopWidth: 1,
        borderColor: '#eee',
        paddingTop: 20,
        paddingBottom: 40,
    },
    savePromptTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    savePromptText: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 20,
        lineHeight: 18,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    saveButton: {
        flex: 1,
        height: 50,
        backgroundColor: '#4c1d95',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 5,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },

    // ---- Processing Loader ----
    loaderOverlay: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderBox: {
        alignItems: 'center',
        width: '80%',
    },
    loaderText: {
        marginTop: 15,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4c1d95',
    },
    progressBar: {
        height: 6,
        width: '100%',
        backgroundColor: '#eee',
        borderRadius: 3,
        marginTop: 20,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4c1d95',
    },
});
