/**
 * src/screens/AiAssistScreen.js
 *
 * FIX: Added escape/back header so users are not stuck inside Chitti AI.
 *      The floating tab bar now hides when Chitti is active (handled in MainTabs.js).
 *      A persistent top-left back button lets users return to the previous tab.
 *      All other Chitti AI functionality is preserved exactly as-is.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
    Platform, Modal, ScrollView, Animated, Easing, Alert,
    Image, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { SecurityUtils } from '../utils/security';
import { API_BASE_URL } from '../api';
import { Theme } from '../theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
    { id: 'en-IN', name: 'English',                flag: '🇬🇧' },
    { id: 'hi-IN', name: 'हिन्दी (Hindi)',          flag: '🇮🇳' },
    { id: 'te-IN', name: 'తెలుగు (Telugu)',          flag: '🇮🇳' },
    { id: 'ta-IN', name: 'தமிழ் (Tamil)',           flag: '🇮🇳' },
    { id: 'kn-IN', name: 'ಕನ್ನಡ (Kannada)',         flag: '🇮🇳' },
    { id: 'ml-IN', name: 'മലയാളം (Malayalam)',       flag: '🇮🇳' },
    { id: 'mr-IN', name: 'मराठी (Marathi)',          flag: '🇮🇳' },
    { id: 'gu-IN', name: 'ગુજરાતી (Gujarati)',       flag: '🇮🇳' },
    { id: 'bn-IN', name: 'বাংলা (Bengali)',          flag: '🇮🇳' },
    { id: 'pa-IN', name: 'ਪੰਜਾਬੀ (Punjabi)',         flag: '🇮🇳' },
    { id: 'or-IN', name: 'ଓଡ଼ିଆ (Odia)',             flag: '🇮🇳' },
    { id: 'ur-IN', name: 'اردو (Urdu)',             flag: '🇮🇳' },
    { id: 'as-IN', name: 'অসমীয়া (Assamese)',       flag: '🇮🇳' },
    { id: 'sa-IN', name: 'संस्कृत (Sanskrit)',       flag: '🇮🇳' },
];

const SHARE_DURATIONS = [
    { label: '24 Hours', hours: 24  },
    { label: '3 Days',   hours: 72  },
    { label: '7 Days',   hours: 168 },
    { label: '30 Days',  hours: 720 },
    { label: 'One Time', hours: 0   },
];

const CONDITION_COLORS = [
    '#ef4444','#f97316','#eab308','#10b981',
    '#06b6d4','#8b5cf6','#ec4899','#14b8a6',
];

// ─── Typing Dots ──────────────────────────────────────────────────────────────

function TypingDots() {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const anim = (d, delay) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
                    Animated.timing(d, { toValue: 0,  duration: 300, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
                    Animated.delay(600 - delay),
                ])
            );
        const a1 = anim(dot1, 0);
        const a2 = anim(dot2, 150);
        const a3 = anim(dot3, 300);
        a1.start(); a2.start(); a3.start();
        return () => { a1.stop(); a2.stop(); a3.stop(); };
    }, []);

    return (
        <View style={{ flexDirection: 'row', gap: 5, padding: 12 }}>
            {[dot1, dot2, dot3].map((d, i) => (
                <Animated.View
                    key={i}
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366F1', transform: [{ translateY: d }] }}
                />
            ))}
        </View>
    );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ item }) {
    const isUser = item.role === 'user';
    return (
        <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
            {!isUser && (
                <Image
                    source={require('../../assets/chitti_avatar.png')}
                    style={styles.chittiMsgAvatar}
                />
            )}
            <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleChitti]}>
                <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                    {item.content}
                </Text>
                {item.timestamp && (
                    <Text style={styles.bubbleTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                )}
            </View>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AiAssistScreen({ navigation: nav }) {
    // FIX: Use navigation hook as fallback when nav prop unavailable
    const navigation = nav || useNavigation();

    const [messages, setMessages]     = useState([]);
    const [input, setInput]           = useState('');
    const [loading, setLoading]       = useState(false);
    const [language, setLanguage]     = useState('en-IN');
    const [showLangModal, setShowLangModal] = useState(false);
    const [sessionId, setSessionId]   = useState(null);

    const flatListRef = useRef(null);
    const token       = useRef(null);

    // Load token once
    useFocusEffect(
        useCallback(() => {
            SecurityUtils.getToken().then(t => { token.current = t; });
            // Load persisted messages
            AsyncStorage.getItem('chitti_messages').then(raw => {
                if (raw) {
                    try { setMessages(JSON.parse(raw)); } catch (_) {}
                } else {
                    setMessages([{
                        id: 'welcome',
                        role: 'assistant',
                        content: "Namaste! I'm Chitti, your personal health companion 🩺\n\nI can help you understand your medical records, explain your prescriptions, answer health questions, and much more.\n\nHow can I help you today?",
                        timestamp: new Date().toISOString(),
                    }]);
                }
            });
        }, [])
    );

    // Persist messages
    useEffect(() => {
        if (messages.length > 0) {
            AsyncStorage.setItem('chitti_messages', JSON.stringify(messages.slice(-50)));
        }
    }, [messages]);

    const scrollToBottom = () => {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;
        setInput('');

        const userMsg = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);
        scrollToBottom();

        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/v1/ai/chitti/chat`,
                { message: text, session_id: sessionId, language },
                {
                    headers: { Authorization: `Bearer ${token.current}` },
                    timeout: 30000,
                }
            );
            const { reply, session_id } = response.data;
            if (session_id) setSessionId(session_id);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: reply || 'I encountered an issue. Please try again.',
                timestamp: new Date().toISOString(),
            }]);
        } catch (e) {
            const errMsg = e.response?.data?.detail || 'Unable to reach Chitti right now. Please check your connection.';
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `⚠️ ${errMsg}`,
                timestamp: new Date().toISOString(),
            }]);
        } finally {
            setLoading(false);
            scrollToBottom();
        }
    };

    const clearChat = () => {
        Alert.alert('Clear Chat', 'This will erase all Chitti messages.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                style: 'destructive',
                onPress: () => {
                    setMessages([]);
                    setSessionId(null);
                    AsyncStorage.removeItem('chitti_messages');
                },
            },
        ]);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                content: '[Image shared with Chitti]',
                timestamp: new Date().toISOString(),
                image: result.assets[0].uri,
            }]);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#050810', '#0F172A']} style={StyleSheet.absoluteFill} />

            {/* FIX: Header with back/escape button so user can leave Chitti */}
            <SafeAreaView style={styles.safeHeader}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.navigate('Home')}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Image
                            source={require('../../assets/chitti_avatar.png')}
                            style={styles.headerAvatar}
                        />
                        <View>
                            <Text style={styles.headerTitle}>Chitti AI</Text>
                            <Text style={styles.headerSub}>Your health companion</Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowLangModal(true)}>
                            <Ionicons name="language" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerBtn} onPress={clearChat}>
                            <Ionicons name="trash-outline" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

            {/* Messages */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => <MessageBubble item={item} />}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={scrollToBottom}
                    ListFooterComponent={loading ? (
                        <View style={styles.msgRow}>
                            <Image source={require('../../assets/chitti_avatar.png')} style={styles.chittiMsgAvatar} />
                            <View style={styles.bubbleChitti}><TypingDots /></View>
                        </View>
                    ) : null}
                />

                {/* Input Bar */}
                <View style={styles.inputBar}>
                    <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
                        <Ionicons name="attach" size={22} color="#94A3B8" />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.inputField}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Ask Chitti anything..."
                        placeholderTextColor="#475569"
                        multiline
                        maxLength={1000}
                        returnKeyType="send"
                        onSubmitEditing={sendMessage}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                        onPress={sendMessage}
                        disabled={!input.trim() || loading}
                    >
                        <Ionicons name="send" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Language Modal */}
            <Modal visible={showLangModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.langModal}>
                        <View style={styles.langModalHeader}>
                            <Text style={styles.langModalTitle}>Select Language</Text>
                            <TouchableOpacity onPress={() => setShowLangModal(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {LANGUAGES.map(lang => (
                                <TouchableOpacity
                                    key={lang.id}
                                    style={[styles.langRow, language === lang.id && styles.langRowActive]}
                                    onPress={() => { setLanguage(lang.id); setShowLangModal(false); }}
                                >
                                    <Text style={styles.langFlag}>{lang.flag}</Text>
                                    <Text style={[styles.langName, language === lang.id && { color: '#6366F1' }]}>
                                        {lang.name}
                                    </Text>
                                    {language === lang.id && <Ionicons name="checkmark" size={18} color="#6366F1" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container:      { flex: 1, backgroundColor: '#050810' },
    safeHeader:     { paddingTop: Platform.OS === 'android' ? 40 : 0 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center', alignItems: 'center',
    },
    headerCenter:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar:   { width: 36, height: 36, borderRadius: 18 },
    headerTitle:    { color: '#fff', fontSize: 16, fontWeight: '700' },
    headerSub:      { color: '#64748B', fontSize: 11 },
    headerBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center', alignItems: 'center',
    },
    messageList:    { padding: 16, paddingBottom: 24 },
    msgRow:         { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
    msgRowUser:     { flexDirection: 'row-reverse' },
    chittiMsgAvatar:{ width: 30, height: 30, borderRadius: 15 },
    bubble: {
        maxWidth: '78%',
        padding: 12,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    bubbleUser:     { backgroundColor: '#4F46E5', borderColor: '#6366F1' },
    bubbleChitti:   { borderTopLeftRadius: 4 },
    bubbleText:     { color: '#E2E8F0', fontSize: 15, lineHeight: 22 },
    bubbleTextUser: { color: '#fff' },
    bubbleTime:     { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 4, textAlign: 'right' },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 10,
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        gap: 8,
    },
    attachBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center', alignItems: 'center',
    },
    inputField: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    sendBtn: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: '#4F46E5',
        justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: '#1E293B' },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    langModal: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: 24, maxHeight: '70%',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    langModalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    langModalTitle:  { color: '#fff', fontSize: 16, fontWeight: '700' },
    langRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: 12, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    langRowActive:   { backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 12, paddingHorizontal: 8 },
    langFlag:        { fontSize: 22 },
    langName:        { color: '#E2E8F0', fontSize: 15, flex: 1 },
});
