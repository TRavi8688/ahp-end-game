import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Image, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
import { Audio } from 'expo-av';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { SecurityUtils } from '../utils/security';
import { Theme, GlobalStyles } from '../theme';
import { API_BASE_URL } from '../api';
import HapticUtils from '../utils/HapticUtils';

const { width } = Dimensions.get('window');

const LANGUAGES = [
    { id: 'en-IN', name: 'English', flag: '🇬🇧' },
    { id: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
    { id: 'te-IN', name: 'తెలుగు', flag: '🇮🇳' },
    { id: 'ta-IN', name: 'தமிழ்', flag: '🇮🇳' },
    { id: 'kn-IN', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

export default function ChittiAiScreen() {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [selectedLang, setSelectedLang] = useState('en-IN');
    const [showLangModal, setShowLangModal] = useState(false);
    const [userName, setUserName] = useState('');

    const flatListRef = useRef();

    useEffect(() => {
        const fetchContext = async () => {
            try {
                const token = await SecurityUtils.getToken();
                const activeMemberId = await SecurityUtils.getActiveMemberId();
                const headers = { Authorization: `Bearer ${token}` };
                if (activeMemberId) {
                    headers['X-Family-Member-ID'] = activeMemberId;
                }

                const resp = await axios.get(`${API_BASE_URL}/patient/profile`, { headers });
                const name = resp.data.full_name?.split(' ')[0] || 'there';
                setUserName(name);
                
                // Start clean session by default
                setMessages([
                    { 
                        id: 'welcome', 
                        sender: 'ai', 
                        text: `Namaste ${name}! 🌿 I am Chitti, your clinical neural companion. I have established a secure bridge with your health ledger. How can I assist you today?` 
                    }
                ]);
            } catch (e) {
                console.error("Context Error:", e);
                setMessages([{ id: '1', sender: 'ai', text: 'Identity bridge active. How can I assist your clinical journey today?' }]);
            }
        };

        fetchContext();
    }, []);

    const sendMessage = async (text, audioFile = null, imageFile = null) => {
        if (!text && !audioFile && !imageFile) return;

        HapticUtils.medium();
        let displayMsg = text || (audioFile ? 'Voice Note 🎙️' : 'Shared Clinical Visual 🖼️');
        const userMsg = { id: Date.now().toString(), sender: 'user', text: displayMsg };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);

        try {
            const token = await SecurityUtils.getToken();
            const activeMemberId = await SecurityUtils.getActiveMemberId();
            const headers = { 'Authorization': `Bearer ${token}` };
            if (activeMemberId) {
                headers['X-Family-Member-ID'] = activeMemberId;
            }

            const formData = new FormData();
            if (text) formData.append('text', text);
            formData.append('language_code', selectedLang);

            if (audioFile) {
                formData.append('audio', {
                    uri: audioFile.uri,
                    name: 'speech.m4a',
                    type: 'audio/m4a'
                });
            }

            if (imageFile) {
                formData.append('file', {
                    uri: imageFile.uri,
                    name: 'analysis_request.jpg',
                    type: 'image/jpeg'
                });
            }

            const response = await axios.post(`${API_BASE_URL}/patient/chat`, formData, { headers });

            HapticUtils.success();
            const aiMsg = { id: (Date.now() + 1).toString(), sender: 'ai', text: response.data.ai_text };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            HapticUtils.error();
            const errorMsg = { id: (Date.now() + 1).toString(), sender: 'ai', text: 'Secure bridge interrupted. Re-establishing connection...' };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const startRecording = async () => {
        try {
            HapticUtils.impactAsync(HapticUtils.ImpactFeedbackStyle.Heavy);
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(recording);
            setIsRecording(true);
        } catch (err) {
            console.error('Recording fail:', err);
        }
    };

    const stopRecording = async () => {
        setIsRecording(false);
        if (!recording) return;
        try {
            HapticUtils.selection();
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            sendMessage(null, { uri });
            setRecording(null);
        } catch (err) {
            console.error('Stop fail:', err);
        }
    };

    const renderItem = ({ item }) => (
        <Animated.View 
            entering={item.sender === 'user' ? FadeInDown : FadeInUp} 
            layout={Layout.springify()}
            style={[styles.messageRow, item.sender === 'user' ? styles.userRow : styles.aiRow]}
        >
            {item.sender === 'ai' && (
                <View style={styles.avatarContainer}>
                    <Image source={require('../../assets/chitti_avatar.png')} style={styles.chittiAvatar} />
                    <View style={styles.onlinePulse} />
                </View>
            )}
            <View style={[
                styles.messageBubble, 
                GlobalStyles.glass,
                item.sender === 'user' ? styles.userBubble : styles.aiBubble
            ]}>
                <Text style={[styles.messageText, item.sender === 'user' ? styles.userText : styles.aiText]}>
                    {item.text}
                </Text>
            </View>
        </Animated.View>
    );

    const CurrentLang = LANGUAGES.find(l => l.id === selectedLang);

    return (
        <View style={GlobalStyles.screen}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : null}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <LinearGradient colors={['#050810', '#0F172A']} style={styles.header}>
                    <View style={styles.headerProfile}>
                        <Image source={require('../../assets/chitti_avatar.png')} style={styles.headerAvatar} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerName}>CHITTI CLINICAL CORE</Text>
                            <View style={styles.statusRow}>
                                <View style={styles.statusDot} />
                                <Text style={styles.statusText}>FORENSIC LEDGER SYNCED</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.langBtn, GlobalStyles.glass]} onPress={() => { HapticUtils.light(); setShowLangModal(true); }}>
                            <Text style={styles.langBtnText}>{CurrentLang.flag} {CurrentLang.name}</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    showsVerticalScrollIndicator={false}
                />

                {isTyping && (
                    <Animated.View entering={FadeInDown} style={styles.typingContainer}>
                        <ActivityIndicator size="small" color={Theme.colors.primary} />
                        <Text style={styles.typingText}>Chitti is analyzing clinical data...</Text>
                    </Animated.View>
                )}

                <View style={[styles.inputContainer, GlobalStyles.glass]}>
                    <View style={styles.inputWrapper}>
                        <TouchableOpacity 
                            style={styles.actionIcon} 
                            onPress={async () => {
                                HapticUtils.light();
                                const result = await ImagePicker.launchCameraAsync({
                                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                    allowsEditing: true,
                                    quality: 0.8,
                                });
                                if (!result.canceled) sendMessage(null, null, result.assets[0]);
                            }}
                        >
                            <Ionicons name="camera" size={22} color={Theme.colors.primary} />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Ask about your health..."
                            placeholderTextColor="#475569"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                        />
                    </View>

                    {inputText.length > 0 ? (
                        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage(inputText)}>
                            <LinearGradient colors={[Theme.colors.primary, Theme.colors.secondary]} style={styles.btnGradient}>
                                <Ionicons name="send" size={18} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.micButton, isRecording && styles.micActive]}
                            onLongPress={startRecording}
                            onPressOut={stopRecording}
                        >
                            <Ionicons name={isRecording ? "mic" : "mic-outline"} size={22} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>

            <Modal visible={showLangModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <Animated.View entering={FadeInUp} style={[styles.modalContent, GlobalStyles.glass]}>
                        <Text style={styles.modalTitle}>LINGUISTIC CONTEXT</Text>
                        {LANGUAGES.map(lang => (
                            <TouchableOpacity
                                key={lang.id}
                                style={[styles.langOption, selectedLang === lang.id && styles.langOptionActive]}
                                onPress={() => { HapticUtils.selection(); setSelectedLang(lang.id); setShowLangModal(false); }}
                            >
                                <Text style={lang.id === selectedLang ? { ...styles.langText, color: Theme.colors.primary, fontWeight: 'bold' } : styles.langText}>{lang.flag} {lang.name}</Text>
                                {selectedLang === lang.id && <Ionicons name="shield-checkmark" size={20} color={Theme.colors.primary} />}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.closeButton} onPress={() => setShowLangModal(false)}>
                            <Text style={styles.closeButtonText}>DISMISS</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, paddingBottom: 24 },
    headerProfile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: Theme.colors.primary },
    headerName: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
    statusText: { color: '#64748B', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
    langBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
    langBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    listContent: { padding: 20 },
    messageRow: { flexDirection: 'row', marginBottom: 24, alignItems: 'flex-end', gap: 10 },
    userRow: { justifyContent: 'flex-end' },
    aiRow: { justifyContent: 'flex-start' },
    avatarContainer: { position: 'relative' },
    chittiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(34, 211, 238, 0.1)' },
    onlinePulse: { position: 'absolute', right: 0, bottom: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#050810' },
    messageBubble: { maxWidth: '80%', padding: 16, borderRadius: 24 },
    userBubble: { backgroundColor: 'rgba(34, 211, 238, 0.15)', borderBottomRightRadius: 4, borderColor: 'rgba(34, 211, 238, 0.2)' },
    aiBubble: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderBottomLeftRadius: 4, borderColor: 'rgba(255,255,255,0.05)' },
    messageText: { fontSize: 15, lineHeight: 22, color: '#E2E8F0' },
    userText: { color: '#fff', fontWeight: '500' },
    aiText: { color: '#E2E8F0' },
    typingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20, gap: 12 },
    typingText: { fontSize: 11, color: '#64748B', fontWeight: 'bold' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, margin: 16, borderRadius: 24, gap: 10 },
    inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, paddingHorizontal: 12 },
    input: { flex: 1, paddingVertical: 12, color: '#fff', fontSize: 15, maxHeight: 100 },
    actionIcon: { padding: 8 },
    micButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    micActive: { backgroundColor: '#EF4444' },
    sendButton: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
    btnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 24 },
    modalContent: { borderRadius: 32, padding: 24 },
    modalTitle: { fontSize: 14, fontWeight: '900', color: Theme.colors.primary, textAlign: 'center', marginBottom: 24, letterSpacing: 2 },
    langOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    langText: { fontSize: 16, color: '#fff', fontWeight: '500' },
    closeButton: { marginTop: 24, padding: 16, alignItems: 'center' },
    closeButtonText: { color: '#64748B', fontSize: 12, fontWeight: '900', letterSpacing: 1 }
});
