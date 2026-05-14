import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../utils/ApiService';
import { HapticUtils } from '../utils/haptics';

export default function UploadScreen({ navigation }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const pickImage = async (useCamera = false) => {
        try {
            HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Light);
            let result;
            if (useCamera) {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') return Alert.alert('Error', 'Camera access is required.');
                result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') return Alert.alert('Error', 'Gallery access is required.');
                result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.7 });
            }

            if (!result.canceled) {
                setFile(result.assets[0]);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const pickDocument = async () => {
        try {
            HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Light);
            const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
            if (!result.canceled) {
                setFile(result.assets[0]);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick document.');
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setUploadProgress(10);

        try {
            const formData = new FormData();
            const fileUri = file.uri;
            const fileName = file.name || `Hospyn_${Date.now()}.jpg`;
            const fileType = file.mimeType || 'image/jpeg';

            if (Platform.OS === 'web') {
                const res = await fetch(fileUri);
                const blob = await res.blob();
                formData.append('file', new File([blob], fileName, { type: fileType }));
            } else {
                formData.append('file', { uri: fileUri, name: fileName, type: fileType });
            }

            setUploadProgress(50);
            const response = await ApiService.uploadReport(formData);
            setUploadProgress(100);

            if (response.status === 'success') {
                HapticUtils.notificationAsync(HapticUtils.NotificationFeedbackType.Success);
                Alert.alert('Success', 'Report uploaded and analyzed by Chitti AI!', [
                    { text: 'View Records', onPress: () => navigation.navigate('Records') }
                ]);
                setFile(null);
            } else {
                Alert.alert('Analysis Failed', response.message || 'Could not process report.');
            }
        } catch (e) {
            Alert.alert('Error', 'Upload failed. Please check your connection.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <LinearGradient colors={['#4c1d95', '#7c3aed']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Upload Record</Text>
            </LinearGradient>

            <View style={styles.content}>
                {!file ? (
                    <View style={styles.uploadOptions}>
                        <Text style={styles.sectionTitle}>Select document source</Text>
                        <TouchableOpacity style={styles.optionBtn} onPress={() => pickImage(true)}>
                            <View style={[styles.iconBox, { backgroundColor: '#f5f3ff' }]}>
                                <Ionicons name="camera" size={32} color="#4c1d95" />
                            </View>
                            <View style={styles.optionText}>
                                <Text style={styles.optionTitle}>Take a Photo</Text>
                                <Text style={styles.optionSub}>Scan your physical report now</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionBtn} onPress={() => pickImage(false)}>
                            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                                <Ionicons name="images" size={32} color="#2563eb" />
                            </View>
                            <View style={styles.optionText}>
                                <Text style={styles.optionTitle}>Gallery</Text>
                                <Text style={styles.optionSub}>Pick from your photo library</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionBtn} onPress={pickDocument}>
                            <View style={[styles.iconBox, { backgroundColor: '#fdf2f8' }]}>
                                <Ionicons name="document-text" size={32} color="#db2777" />
                            </View>
                            <View style={styles.optionText}>
                                <Text style={styles.optionTitle}>PDF / File</Text>
                                <Text style={styles.optionSub}>Upload digital medical reports</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.previewContainer}>
                        <View style={styles.previewCard}>
                            {file.mimeType?.includes('image') || file.uri?.includes('data:image') || !file.mimeType ? (
                                <Image source={{ uri: file.uri }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.pdfIcon}>
                                    <Ionicons name="document-attach" size={80} color="#4c1d95" />
                                    <Text style={styles.pdfName}>{file.name}</Text>
                                </View>
                            )}
                            <TouchableOpacity style={styles.removeBtn} onPress={() => setFile(null)}>
                                <Ionicons name="close-circle" size={32} color="#ef4444" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            style={[styles.uploadBtn, uploading && styles.disabledBtn]} 
                            onPress={handleUpload}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <View style={styles.loaderRow}>
                                    <ActivityIndicator color="#fff" />
                                    <Text style={styles.uploadBtnText}>Chitti is Reading... {uploadProgress}%</Text>
                                </View>
                            ) : (
                                <>
                                    <Ionicons name="cloud-upload" size={24} color="#fff" />
                                    <Text style={styles.uploadBtnText}>Start AI Analysis</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.infoCard}>
                    <Ionicons name="shield-checkmark" size={24} color="#059669" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.infoTitle}>Clinical Privacy Guard</Text>
                        <Text style={styles.infoDesc}>Your documents are encrypted and analyzed locally by Chitti AI. No human sees your records without your permission.</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f7ff' },
    header: { padding: 20, paddingTop: 60, paddingBottom: 30, flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    content: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 20 },
    optionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    iconBox: { width: 60, height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    optionText: { flex: 1 },
    optionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    optionSub: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
    previewContainer: { alignItems: 'center', marginTop: 10 },
    previewCard: { width: '100%', height: 350, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', position: 'relative', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    pdfIcon: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    pdfName: { marginTop: 15, fontSize: 14, fontWeight: 'bold', color: '#4c1d95', textAlign: 'center' },
    removeBtn: { position: 'absolute', top: 10, right: 10 },
    uploadBtn: { width: '100%', backgroundColor: '#4c1d95', padding: 18, borderRadius: 16, marginTop: 25, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    disabledBtn: { opacity: 0.7 },
    uploadBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    loaderRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    infoCard: { flexDirection: 'row', backgroundColor: '#ecfdf5', padding: 20, borderRadius: 20, marginTop: 40, alignItems: 'center', borderWeight: 1, borderColor: '#d1fae5' },
    infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#065f46' },
    infoDesc: { fontSize: 12, color: '#065f46', marginTop: 4, lineHeight: 18 }
});
