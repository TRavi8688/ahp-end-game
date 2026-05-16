import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import ApiService from '../utils/ApiService';
import HapticUtils from '../utils/HapticUtils';
import { Theme, GlobalStyles } from '../theme';

const { width } = Dimensions.get('window');

export default function UploadScreen({ navigation }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const scanLineY = useSharedValue(0);

    const startScanAnimation = () => {
        scanLineY.value = withRepeat(
            withSequence(
                withTiming(350, { duration: 1500 }),
                withTiming(0, { duration: 1500 })
            ),
            -1,
            true
        );
    };

    const animatedScanStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: scanLineY.value }],
    }));

    const pickImage = async (useCamera = false) => {
        HapticUtils.light();
        try {
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
                HapticUtils.selection();
                setFile(result.assets[0]);
            }
        } catch (e) {
            HapticUtils.error();
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const pickDocument = async () => {
        HapticUtils.light();
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
            if (!result.canceled) {
                HapticUtils.selection();
                setFile(result.assets[0]);
            }
        } catch (e) {
            HapticUtils.error();
            Alert.alert('Error', 'Failed to pick document.');
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        HapticUtils.medium();
        setUploading(true);
        setUploadProgress(10);
        startScanAnimation();

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

            setUploadProgress(40);
            const response = await ApiService.uploadReport(formData);
            setUploadProgress(100);

            if (response.status === 'success' || response.record_id) {
                HapticUtils.success();
                Alert.alert('Success', 'Report uploaded and staged for Chitti AI analysis.', [
                    { text: 'View Vault', onPress: () => navigation.navigate('Records') }
                ]);
                setFile(null);
            } else {
                HapticUtils.error();
                Alert.alert('Upload Issue', response.message || 'Could not process report.');
            }
        } catch (e) {
            HapticUtils.error();
            console.error(e);
            Alert.alert('Network Error', 'The clinical bridge failed to receive the data. Re-trying in 2s...');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    return (
        <View style={GlobalStyles.screen}>
            <LinearGradient colors={['#050810', '#0F172A']} style={styles.header}>
                <TouchableOpacity onPress={() => { HapticUtils.light(); navigation.goBack(); }} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>VAULT INGESTION</Text>
                    <Text style={styles.headerSub}>Secure Clinical Data Processing</Text>
                </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {!file ? (
                    <Animated.View entering={FadeInUp} style={styles.uploadOptions}>
                        <Text style={styles.sectionTitle}>Digitalize Clinical Evidence</Text>
                        
                        <TouchableOpacity style={[styles.optionBtn, GlobalStyles.glass]} onPress={() => pickImage(true)}>
                            <View style={[styles.iconBox, { backgroundColor: 'rgba(34, 211, 238, 0.1)' }]}>
                                <Ionicons name="camera" size={28} color={Theme.colors.primary} />
                            </View>
                            <View style={styles.optionText}>
                                <Text style={styles.optionTitle}>Direct Capture</Text>
                                <Text style={styles.optionSub}>Scan physical prescriptions or reports</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#334155" />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.optionBtn, GlobalStyles.glass]} onPress={() => pickImage(false)}>
                            <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                <Ionicons name="images" size={28} color="#10b981" />
                            </View>
                            <View style={styles.optionText}>
                                <Text style={styles.optionTitle}>Import from Gallery</Text>
                                <Text style={styles.optionSub}>Process existing healthcare images</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#334155" />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.optionBtn, GlobalStyles.glass]} onPress={pickDocument}>
                            <View style={[styles.iconBox, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                                <Ionicons name="document-text" size={28} color="#6366f1" />
                            </View>
                            <View style={styles.optionText}>
                                <Text style={styles.optionTitle}>Digital PDF</Text>
                                <Text style={styles.optionSub}>Upload lab reports or e-prescriptions</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#334155" />
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <Animated.View entering={FadeIn} style={styles.previewContainer}>
                        <View style={styles.previewCard}>
                            {file.mimeType?.includes('image') || file.uri?.includes('data:image') || !file.mimeType ? (
                                <Image source={{ uri: file.uri }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.pdfIcon}>
                                    <Ionicons name="document-attach" size={80} color={Theme.colors.primary} />
                                    <Text style={styles.pdfName}>{file.name}</Text>
                                </View>
                            )}
                            
                            {uploading && (
                                <Animated.View style={[styles.scanLine, animatedScanStyle]}>
                                    <LinearGradient 
                                        colors={['transparent', Theme.colors.primary, 'transparent']} 
                                        style={StyleSheet.absoluteFill} 
                                        start={{x:0, y:0.5}} 
                                        end={{x:1, y:0.5}} 
                                    />
                                </Animated.View>
                            )}

                            {!uploading && (
                                <TouchableOpacity style={styles.removeBtn} onPress={() => { HapticUtils.light(); setFile(null); }}>
                                    <Ionicons name="close-circle" size={32} color={Theme.colors.critical} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity 
                            style={[styles.uploadBtn, uploading && styles.disabledBtn]} 
                            onPress={handleUpload}
                            disabled={uploading}
                        >
                            <LinearGradient 
                                colors={[Theme.colors.primary, Theme.colors.secondary]} 
                                start={{x:0, y:0}} 
                                end={{x:1, y:0}} 
                                style={styles.gradientBtn}
                            >
                                {uploading ? (
                                    <View style={styles.loaderRow}>
                                        <ActivityIndicator color="#fff" />
                                        <Text style={styles.uploadBtnText}>CHITTI IS READING... {uploadProgress}%</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Ionicons name="sparkles" size={20} color="#fff" />
                                        <Text style={styles.uploadBtnText}>BEGIN AI ANALYSIS</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                <View style={[styles.infoCard, GlobalStyles.glass]}>
                    <Ionicons name="shield-checkmark" size={24} color="#10b981" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.infoTitle}>Clinical Sovereignty</Text>
                        <Text style={styles.infoDesc}>Your health data is end-to-end encrypted. AI analysis is conducted on private clinical nodes. You remain in control of access.</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, paddingBottom: 24, flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 20 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: Theme.fonts.heading },
    headerSub: { fontSize: 10, color: '#64748B', fontWeight: 'bold', letterSpacing: 1 },
    scrollContent: { padding: 24 },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 24, fontFamily: Theme.fonts.headingSemi },
    optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, marginBottom: 16 },
    iconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    optionText: { flex: 1 },
    optionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    optionSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    previewContainer: { alignItems: 'center' },
    previewCard: { width: '100%', height: 350, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 32, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    pdfIcon: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    pdfName: { marginTop: 15, fontSize: 14, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    scanLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, zIndex: 10, shadowColor: '#22D3EE', shadowOpacity: 0.5, shadowRadius: 10 },
    removeBtn: { position: 'absolute', top: 16, right: 16 },
    uploadBtn: { width: '100%', marginTop: 24, borderRadius: 20, overflow: 'hidden' },
    gradientBtn: { height: 60, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
    disabledBtn: { opacity: 0.7 },
    uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    loaderRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    infoCard: { flexDirection: 'row', padding: 20, borderRadius: 24, marginTop: 40, alignItems: 'center' },
    infoTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
    infoDesc: { fontSize: 11, color: '#64748B', marginTop: 4, lineHeight: 16 }
});

