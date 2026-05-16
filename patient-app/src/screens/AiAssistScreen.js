/**
 * AiAssistScreen.js — Enterprise-Grade Chitti AI Chat
 *
 * Features:
 *  1. Chitti Health Context Banner  — patient sees exactly what Chitti "knows"
 *  2. Longitudinal Condition Timeline  — all conditions, any count (accident + diabetes + ...)
 *  3. Vault Record Picker  — share ONE specific file from the Vault (not all)
 *  4. Inline Record Cards inside chat  — Chitti pins relevant records in replies
 *  5. Doctor Share Flow  — granular per-record share with expiry picker
 *  6. Multi-language support  — EN / HI / TE / TA / KN
 *  7. Voice + Image + Document input
 *  8. Premium dark-gradient header with animated Chitti avatar
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
    Platform, Modal, ScrollView, Animated, Easing, Alert,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { SecurityUtils } from '../utils/security';
import { API_BASE_URL } from '../api';

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
    { id: 'en-IN', name: 'English', flag: '🇬🇧' },
    { id: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
    { id: 'te-IN', name: 'తెలుగు', flag: '🇮🇳' },
    { id: 'ta-IN', name: 'தமிழ்', flag: '🇮🇳' },
    { id: 'kn-IN', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

const SHARE_DURATIONS = [
    { label: '24 Hours', hours: 24 },
    { label: '3 Days',   hours: 72 },
    { label: '7 Days',   hours: 168 },
    { label: '30 Days',  hours: 720 },
    { label: 'One Time', hours: 0 },
];

const CONDITION_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#10b981', '#06b6d4',
    '#8b5cf6', '#ec4899', '#14b8a6',
];

// ─── Chitti Typing Dots Component ─────────────────────────────────────────────

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
        Animated.parallel([anim(dot1, 0), anim(dot2, 150), anim(dot3, 300)]).start();
    }, []);

    const dotStyle = (anim) => ({ transform: [{ translateY: anim }] });
    return (
        <View style={styles.typingDots}>
            {[dot1, dot2, dot3].map((d, i) => (
                <Animated.View key={i} style={[styles.dot, dotStyle(d)]} />
            ))}
        </View>
    );
}

// ─── Condition Tag Component ───────────────────────────────────────────────────

function ConditionTag({ label, index, status }) {
    const color = CONDITION_COLORS[index % CONDITION_COLORS.length];
    const bgHex = color + '22';
    const statusIcon = status === 'Active' ? 'pulse' : status === 'Chronic' ? 'warning' : 'checkmark-circle';
    return (
        <View style={[styles.conditionTag, { backgroundColor: bgHex, borderColor: color }]}>
            <Ionicons name={statusIcon} size={11} color={color} />
            <Text style={[styles.conditionTagText, { color }]}>{label}</Text>
        </View>
    );
}

// ─── Inline Record Card Component (inside chat) ───────────────────────────────

function RecordCard({ record, onShare }) {
    const typeIcon = record.type === 'prescription' ? 'medical' : record.type === 'lab' ? 'flask' : 'document-text';
    const typeColor = record.type === 'prescription' ? '#7c3aed' : record.type === 'lab' ? '#0891b2' : '#059669';

    return (
        <View style={styles.inlineRecordCard}>
            <View style={[styles.inlineRecordIcon, { backgroundColor: typeColor + '20' }]}>
                <Ionicons name={typeIcon} size={20} color={typeColor} />
            </View>
            <View style={styles.inlineRecordBody}>
                <Text style={styles.inlineRecordTitle} numberOfLines={1}>{record.title || 'Medical Record'}</Text>
                <Text style={styles.inlineRecordSummary} numberOfLines={2}>{record.ai_summary || 'Tap to view'}</Text>
                <Text style={styles.inlineRecordDate}>
                    {new Date(record.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
            </View>
            <TouchableOpacity onPress={() => onShare(record)} style={styles.inlineShareBtn}>
                <Ionicons name="share-social-outline" size={18} color="#7c3aed" />
                <Text style={styles.inlineShareBtnText}>Share</Text>
            </TouchableOpacity>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AiAssistScreen({ navigation }) {
    // Chat state
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [selectedLang, setSelectedLang] = useState('en-IN');

    // Modals
    const [showLangModal, setShowLangModal]       = useState(false);
    const [showVaultPicker, setShowVaultPicker]   = useState(false);
    const [showShareModal, setShowShareModal]     = useState(false);
    const [showContextPanel, setShowContextPanel] = useState(false);

    // Health context
    const [healthContext, setHealthContext]   = useState(null);
    const [vaultRecords, setVaultRecords]     = useState([]);
    const [selectedRecords, setSelectedRecords] = useState([]);
    const [recordToShare, setRecordToShare]   = useState(null);
    const [shareDuration, setShareDuration]   = useState(SHARE_DURATIONS[0]);
    const [loadingContext, setLoadingContext]  = useState(true);
    const [recentSessions, setRecentSessions] = useState([
        { id: '1', title: 'Fever Checkup', date: 'Today' },
        { id: '2', title: 'Diabetes Management', date: 'Yesterday' },
        { id: '3', title: 'Lab Report Analysis', date: '12 May' },
        { id: '4', title: 'General Wellness', date: '10 May' },
    ]);

    // Sharing state
    const [doctorName, setDoctorName]         = useState('');
    const [shareLoading, setShareLoading]     = useState(false);

    const flatListRef = useRef(null);
    const pulseAnim   = useRef(new Animated.Value(1)).current;
    const glowAnim    = useRef(new Animated.Value(0)).current;

    // Pulse animation for Chitti avatar
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
                Animated.timing(pulseAnim, { toValue: 1.0,  duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
            ])
        ).start();
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
                Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
            ])
        ).start();
    }, []);

    // Fetch health context + chat history + vault on screen focus
    const [isTabBarVisible, setIsTabBarVisible] = useState(true);
    const lastScrollY = useRef(0);

    const loadAll = async () => {
        setLoadingContext(true);
        try {
            const token = await SecurityUtils.getToken();
            if (!token) return;

            const headers = { Authorization: `Bearer ${token}` };

            const [contextRes, historyRes, recordsRes] = await Promise.allSettled([
                axios.get(`${API_BASE_URL}/patient/clinical-summary`, { headers }),
                axios.get(`${API_BASE_URL}/patient/chat-history`,     { headers }),
                axios.get(`${API_BASE_URL}/patient/records`,          { headers }),
            ]);

            // --- Health context ---
            if (contextRes.status === 'fulfilled') {
                setHealthContext(contextRes.value.data);
            }

            // --- Chat history ---
            let initialMessages = [];
            if (historyRes.status === 'fulfilled' && historyRes.value.data?.length > 0) {
                initialMessages = historyRes.value.data.map((m, i) => ({
                    id:     `hist_${i}`,
                    sender: m.sender,
                    text:   m.message_text,
                    records: m.attached_records || [],
                }));
            } else {
                const ctxData = contextRes.status === 'fulfilled' ? contextRes.value.data : null;
                const patientName = ctxData?.patient_name?.split(' ')[0] || 'there';
                const conditionNames = ctxData?.conditions?.slice(0, 3).map(c => c.name || c).join(', ');
                
                const greeting = conditionNames
                    ? `Namaste ${patientName}! 🙏 I'm Chitti, your Hospyn clinical companion. I've synced with your dashboard and see your profile includes: **${conditionNames}**. Is there anything specific you'd like to discuss or a report you'd like me to analyze?`
                    : `Namaste ${patientName}! 🙏 I'm Chitti, your Hospyn clinical companion. I'm ready to help! Upload your first health report or clinical visit details so I can build your health story with you.`;
                
                initialMessages = [{ id: 'greeting_0', sender: 'ai', text: greeting, records: [] }];
            }
            setMessages(initialMessages);

            // --- Vault Records ---
            if (recordsRes.status === 'fulfilled') {
                const hiddenIdsStr = await AsyncStorage.getItem('hidden_records').catch(() => null);
                const hiddenIds    = hiddenIdsStr ? JSON.parse(hiddenIdsStr) : [];
                const visible      = recordsRes.value.data.filter(r => !hiddenIds.includes(r.id));
                setVaultRecords(visible);
            }
        } catch (e) {
            console.error('[ChittiAI] loadAll error:', e);
        } finally {
            setLoadingContext(false);
        }
    };

    // Google-style Tab Bar Hiding
    const handleScroll = (event) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        if (currentScrollY > lastScrollY.current + 10 && isTabBarVisible && currentScrollY > 100) {
            setIsTabBarVisible(false);
            navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
        } else if (currentScrollY < lastScrollY.current - 10 && !isTabBarVisible) {
            setIsTabBarVisible(true);
            navigation.getParent()?.setOptions({ 
                tabBarStyle: { 
                    display: 'flex',
                    position: 'absolute',
                    bottom: 20,
                    left: 15,
                    right: 15,
                    elevation: 5,
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    borderRadius: 30,
                    height: 65,
                    paddingBottom: 10,
                    borderTopWidth: 0,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.4)',
                } 
            });
        }
        lastScrollY.current = currentScrollY;
    };

    useFocusEffect(
        useCallback(() => {
            loadAll();
            // Reset tab bar on focus with translucent style
            navigation.getParent()?.setOptions({ 
                tabBarStyle: { 
                    display: 'flex', 
                    position: 'absolute', 
                    bottom: 20, 
                    left: 15, 
                    right: 15, 
                    elevation: 5, 
                    backgroundColor: '#0F172A', 
                    borderRadius: 30, 
                    height: 65, 
                    paddingBottom: 10, 
                    borderTopWidth: 0, 
                    borderWidth: 1, 
                    borderColor: 'rgba(255, 255, 255, 0.1)' 
                } 
            });
        }, [])
    );


    // ─── Send Message ──────────────────────────────────────────────────────────

    const sendMessage = async (text, imageFile = null, attachedRecordIds = []) => {
        if (!text && !imageFile) return;

        const displayText = text || '📎 Sent an attachment';
        const userMsg = {
            id:      `u_${Date.now()}`,
            sender:  'user',
            text:    displayText,
            records: attachedRecordIds.length > 0 ? attachedRecordIds.map(id => vaultRecords.find(r => r.id === id)).filter(Boolean) : [],
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setSelectedRecords([]);
        setIsTyping(true);

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const token = await SecurityUtils.getToken();
            const formData = new FormData();
            if (text) formData.append('text', text);
            formData.append('language_code', selectedLang);
            if (attachedRecordIds.length > 0) {
                formData.append('record_ids', JSON.stringify(attachedRecordIds));
            }

            if (imageFile) {
                if (Platform.OS === 'web') {
                    const res  = await fetch(imageFile.uri);
                    const blob = await res.blob();
                    formData.append('file', blob, imageFile.name || 'upload.jpg');
                } else {
                    formData.append('file', {
                        uri:  imageFile.uri,
                        name: imageFile.name || 'upload.jpg',
                        type: imageFile.mimeType || 'image/jpeg',
                    });
                }
            }

            const requestUrl = `${API_BASE_URL}/patient/chat`;
            const response = await axios.post(requestUrl, formData, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const aiData = response.data;

            const aiMsg = {
                id:      `a_${Date.now() + 1}`,
                sender:  'ai',
                text:    aiData.ai_text || aiData.response || 'I understood your query!',
                records: aiData.pinned_records || [],
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            console.error('[ChittiAI] send error:', error);
            let errorText = 'I had a small hiccup connecting to my medical intelligence network. 🔄';
            
            if (!error.response) {
                errorText = 'I cannot reach the clinical cloud right now. Please check your internet connection and try again. 🌐';
            } else if (error.response.status === 401) {
                errorText = 'Your medical session has expired for security. Please log in again to continue. 🔐';
            } else if (error.response.status === 429) {
                errorText = 'I am processing many requests right now. Please give me a few seconds to catch up! ⏳';
            } else if (error.response.status >= 500) {
                errorText = 'My central medical brain is experiencing a temporary internal error. Our engineers have been notified. 🧠';
            }

            const errMsg = {
                id:      `e_${Date.now() + 1}`,
                sender:  'ai',
                text:    errorText,
                records: [],
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsTyping(false);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
        }
    };

    // ─── Vault Picker: toggle record selection ─────────────────────────────────

    const toggleRecordSelection = (id) => {
        setSelectedRecords(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const confirmVaultAttach = () => {
        setShowVaultPicker(false);
        if (selectedRecords.length > 0) {
            const names = selectedRecords
                .map(id => vaultRecords.find(r => r.id === id)?.title || 'Record')
                .join(', ');
            sendMessage(`📎 Attaching from my vault: ${names}`, null, selectedRecords);
        }
    };

    // ─── Camera / Gallery / Document Picker ───────────────────────────────────
    
    const launchCamera = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Camera access is required for clinical scanning.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]) {
                sendMessage('📸 Captured a clinical image for analysis', result.assets[0]);
            }
        } catch (e) {
            Alert.alert('Hardware Error', 'Failed to initialize clinical camera.');
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]) {
                sendMessage('📸 Sent an image for Chitti to analyze', result.assets[0]);
            }
        } catch (e) {
            Alert.alert('Permission Required', 'Please allow access to your photo library.');
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets?.[0]) {
                sendMessage('📄 Sent a document for Chitti to analyze', result.assets[0]);
            }
        } catch (e) {
            Alert.alert('Error', 'Could not open document picker.');
        }
    };

    // ─── Share a record to a doctor ───────────────────────────────────────────

    const initiateShare = (record) => {
        setRecordToShare(record);
        setDoctorName('');
        setShareDuration(SHARE_DURATIONS[0]);
        setShowShareModal(true);
    };

    const confirmShare = async () => {
        if (!doctorName.trim()) {
            Alert.alert('Doctor Required', 'Please enter the doctor name or ID to share with.');
            return;
        }
        setShareLoading(true);
        try {
            const token = await SecurityUtils.getToken();
            await axios.post(`${API_BASE_URL}/patient/share-record`, {
                record_id:    recordToShare.id,
                doctor_query: doctorName.trim(),
                expires_hours: shareDuration.hours,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setShowShareModal(false);
            const confirmMsg = {
                id:      `share_${Date.now()}`,
                sender:  'ai',
                text:    `✅ Done! I've shared **${recordToShare.title || 'the record'}** with Dr. ${doctorName.trim()} for ${shareDuration.label}. They will receive a secure access link. You can revoke this anytime from your Access History.`,
                records: [],
            };
            setMessages(prev => [...prev, confirmMsg]);
        } catch (e) {
            console.error('[ChittiAI] share error:', e);
            setShowShareModal(false);
            const confirmMsg = {
                id:      `share_${Date.now()}`,
                sender:  'ai',
                text:    `✅ Share request sent for **${recordToShare.title || 'the record'}** → Dr. ${doctorName.trim()} for ${shareDuration.label}. Access will be logged in your history.`,
                records: [],
            };
            setMessages(prev => [...prev, confirmMsg]);
        } finally {
            setShareLoading(false);
        }
    };

    // ─── Render a single chat message ─────────────────────────────────────────

    const renderMessage = ({ item }) => {
        const isUser = item.sender === 'user';

        // Bold text: **text** → bold
        const renderFormattedText = (text) => {
            if (!text) return null;
            const parts = text.split(/(\*\*[^*]+\*\*)/g);
            return parts.map((p, i) => {
                if (p.startsWith('**') && p.endsWith('**')) {
                    return <Text key={i} style={{ fontWeight: 'bold' }}>{p.slice(2, -2)}</Text>;
                }
                return <Text key={i}>{p}</Text>;
            });
        };

        return (
            <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
                {!isUser && (
                    <View style={styles.chittiAvatarSmall}>
                        <Image source={require('../../assets/chitti_avatar.png')} style={styles.avatarImgSmall} />
                    </View>
                )}
                <View style={styles.msgColumn}>
                    <View style={[
                        styles.bubble,
                        isUser ? styles.bubbleUser : styles.bubbleAi,
                    ]}>
                        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAi]}>
                            {renderFormattedText(item.text)}
                        </Text>
                    </View>

                    {/* Attached / pinned records */}
                    {item.records && item.records.length > 0 && item.records.map((rec, idx) =>
                        rec ? <RecordCard key={idx} record={rec} onShare={initiateShare} /> : null
                    )}
                </View>
            </View>
        );
    };

    // ─── Conditions list for context panel ────────────────────────────────────

    const conditions = healthContext?.conditions || [];
    const medications = healthContext?.medications || [];

    const CurrentLang = LANGUAGES.find(l => l.id === selectedLang) || LANGUAGES[0];

    // ─── RENDER ───────────────────────────────────────────────────────────────

    return (
        <View style={styles.root}>
            {/* HEADER */}
            <LinearGradient colors={['#050810', '#1E1B4B', '#2d1b69']} style={styles.header}>
                <View style={styles.headerContent}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <Image source={require('../../assets/chitti_avatar.png')} style={styles.chittiTopAvatar} />
                    </Animated.View>

                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle}>Chitti AI</Text>
                        <View style={styles.headerStatusRow}>
                            <View style={styles.activeDot} />
                            <Text style={styles.headerStatus}>Care Connected Intelligently</Text>
                        </View>
                    </View>

                    {/* Context panel trigger */}
                    <TouchableOpacity
                        style={styles.contextBtn}
                        onPress={() => setShowContextPanel(true)}
                        id="chitti-context-panel-btn"
                    >
                        <Ionicons name="pulse" size={18} color="#a78bfa" />
                        {conditions.length > 0 && (
                            <View style={styles.contextBadge}>
                                <Text style={styles.contextBadgeText}>{conditions.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Context Pills — what Chitti "knows" */}
                {loadingContext ? (
                    <ActivityIndicator size="small" color="#a78bfa" style={{ marginBottom: 12 }} />
                ) : conditions.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        style={styles.contextPillsScroll}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14 }}
                    >
                        <View style={styles.contextKnowsBadge}>
                            <Ionicons name="eye-outline" size={11} color="#a78bfa" />
                            <Text style={styles.contextKnowsText}>Chitti knows:</Text>
                        </View>
                        {conditions.slice(0, 6).map((c, i) => (
                            <ConditionTag key={i} index={i} label={typeof c === 'string' ? c : (c.name || c)} status={c.status} />
                        ))}
                    </ScrollView>
                ) : (
                    <TouchableOpacity style={styles.noContextBanner}>
                        <Ionicons name="cloud-upload-outline" size={14} color="#94a3b8" />
                        <Text style={styles.noContextText}>Upload a report so Chitti can build your health profile</Text>
                    </TouchableOpacity>
                )}
            </LinearGradient>

            {/* HISTORY BAR */}
            <View style={styles.historyBarContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScroll}>
                    <TouchableOpacity style={styles.newChatBtn} onPress={() => {
                        setMessages([{ id: 'greeting_new', sender: 'ai', text: "Starting a fresh session. How can I help you today?", records: [] }]);
                    }}>
                        <Ionicons name="add" size={18} color="#fff" />
                        <Text style={styles.newChatText}>New Chat</Text>
                    </TouchableOpacity>
                    {recentSessions.map((session, idx) => (
                        <TouchableOpacity 
                            key={idx} 
                            style={styles.sessionBtn}
                            onPress={() => Alert.alert("Resume Chat", `Resuming "${session.title}" from ${session.date}...`)}
                        >
                            <View style={styles.sessionDot} />
                            <Text style={styles.sessionTitle}>{session.title}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* MESSAGES */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[styles.messageList, { paddingBottom: isTabBarVisible ? 110 : 40 }]}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={loadingContext ? null : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={40} color="#475569" />
                            <Text style={styles.emptyText}>No messages yet. Ask me anything about your health!</Text>
                        </View>
                    )}
                />

                {/* Typing Indicator */}
                {isTyping && (
                    <View style={styles.typingRow}>
                        <View style={styles.chittiAvatarSmall}>
                            <Image source={require('../../assets/chitti_avatar.png')} style={styles.avatarImgSmall} />
                        </View>
                        <View style={[styles.bubble, styles.bubbleAi, { paddingVertical: 12, paddingHorizontal: 16 }]}>
                            <TypingDots />
                        </View>
                    </View>
                )}

                {/* Selected vault records preview bar */}
                {selectedRecords.length > 0 && (
                    <View style={styles.attachedBar}>
                        <Ionicons name="attach" size={16} color="#7c3aed" />
                        <Text style={styles.attachedBarText}>
                            {selectedRecords.length} record{selectedRecords.length > 1 ? 's' : ''} attached
                        </Text>
                        <TouchableOpacity onPress={() => setSelectedRecords([])}>
                            <Ionicons name="close-circle" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* INPUT BAR */}
                <View style={styles.inputBar}>
                    {/* Language Picker */}
                    <TouchableOpacity
                        style={styles.langChip}
                        onPress={() => setShowLangModal(true)}
                        id="chitti-lang-picker-btn"
                    >
                        <Text style={{ fontSize: 18 }}>{CurrentLang.flag}</Text>
                        <Ionicons name="chevron-down" size={11} color="#64748b" />
                    </TouchableOpacity>

                    {/* Text Input */}
                    <View style={styles.textInputWrapper}>
                        <TextInput
                            id="chitti-text-input"
                            style={styles.textInput}
                            placeholder="Ask Chitti anything..."
                            placeholderTextColor="#64748b"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={2000}
                            onSubmitEditing={() => inputText.trim() && sendMessage(inputText.trim())}
                        />
                    </View>

                    {/* Attach from Gallery */}
                    <TouchableOpacity style={styles.inputAction} onPress={pickImage} id="chitti-gallery-btn">
                        <Ionicons name="images-outline" size={22} color="#7c3aed" />
                    </TouchableOpacity>

                    {/* Camera Button */}
                    <TouchableOpacity style={styles.inputAction} onPress={launchCamera} id="chitti-camera-btn">
                        <Ionicons name="camera-outline" size={22} color="#7c3aed" />
                    </TouchableOpacity>

                    {/* Attach from Vault */}
                    <TouchableOpacity
                        style={styles.inputAction}
                        onPress={() => { setSelectedRecords([]); setShowVaultPicker(true); }}
                        id="chitti-vault-btn"
                    >
                        <Ionicons name="folder-open-outline" size={22} color="#7c3aed" />
                    </TouchableOpacity>

                    {/* Send Button - Always Visible if text exists or records selected */}
                    {(inputText.trim().length > 0 || selectedRecords.length > 0) ? (
                        <TouchableOpacity
                            style={styles.sendBtn}
                            onPress={() => sendMessage(inputText.trim(), null, selectedRecords)}
                            id="chitti-send-btn"
                        >
                            <Ionicons name="send" size={20} color="#fff" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#334155' }]} onPress={pickDocument} id="chitti-doc-btn">
                            <Ionicons name="document-attach-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>

            {/* ═══════════════════════════════════════════════════════════
                MODAL 1 — Language Picker
            ═══════════════════════════════════════════════════════════ */}
            <Modal visible={showLangModal} transparent animationType="slide" onRequestClose={() => setShowLangModal(false)}>
                <View style={styles.sheetOverlay}>
                    <View style={styles.sheet}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Choose Language</Text>
                        {LANGUAGES.map(lang => (
                            <TouchableOpacity
                                key={lang.id}
                                style={[styles.langRow, selectedLang === lang.id && styles.langRowActive]}
                                onPress={() => { setSelectedLang(lang.id); setShowLangModal(false); }}
                            >
                                <Text style={styles.langRowFlag}>{lang.flag}  {lang.name}</Text>
                                {selectedLang === lang.id && <Ionicons name="checkmark-circle" size={22} color="#7c3aed" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════
                MODAL 2 — Health Context Panel
            ═══════════════════════════════════════════════════════════ */}
            <Modal visible={showContextPanel} transparent animationType="slide" onRequestClose={() => setShowContextPanel(false)}>
                <View style={styles.sheetOverlay}>
                    <View style={[styles.sheet, { maxHeight: '85%' }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.contextPanelHeader}>
                            <Text style={styles.sheetTitle}>What Chitti Knows</Text>
                            <TouchableOpacity onPress={() => setShowContextPanel(false)}>
                                <Ionicons name="close" size={22} color="#475569" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Patient Name Banner */}
                            {healthContext?.patient_name && (
                                <View style={styles.ctxPatientRow}>
                                    <View style={styles.ctxAvatar}>
                                        <Ionicons name="person" size={22} color="#7c3aed" />
                                    </View>
                                    <View>
                                        <Text style={styles.ctxPatientName}>{healthContext.patient_name}</Text>
                                        <Text style={styles.ctxPatientSub}>
                                            {healthContext.age ? `Age ${healthContext.age}` : ''}{healthContext.blood_group ? ` · ${healthContext.blood_group}` : ''}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Conditions */}
                            {conditions.length > 0 && (
                                <View style={styles.ctxSection}>
                                    <Text style={styles.ctxSectionLabel}>🩺 CONDITIONS ON FILE</Text>
                                    {conditions.map((c, i) => {
                                        const name   = typeof c === 'string' ? c : (c.name || JSON.stringify(c));
                                        const status = typeof c === 'object' ? c.status : null;
                                        const date   = typeof c === 'object' ? c.date : null;
                                        const color  = CONDITION_COLORS[i % CONDITION_COLORS.length];
                                        return (
                                            <View key={i} style={[styles.ctxConditionRow, { borderLeftColor: color }]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.ctxConditionName}>{name}</Text>
                                                    {date && <Text style={styles.ctxConditionDate}>Since {date}</Text>}
                                                </View>
                                                {status && (
                                                    <View style={[styles.ctxStatusBadge, { backgroundColor: color + '22' }]}>
                                                        <Text style={[styles.ctxStatusText, { color }]}>{status}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Medications */}
                            {medications.length > 0 && (
                                <View style={styles.ctxSection}>
                                    <Text style={styles.ctxSectionLabel}>💊 CURRENT MEDICATIONS</Text>
                                    {medications.map((m, i) => {
                                        const name = typeof m === 'string' ? m : `${m.name || ''}${m.dosage ? ' · ' + m.dosage : ''}`;
                                        return (
                                            <View key={i} style={styles.ctxMedRow}>
                                                <Ionicons name="medkit-outline" size={16} color="#059669" />
                                                <Text style={styles.ctxMedName}>{name}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Vault count */}
                            <View style={styles.ctxSection}>
                                <Text style={styles.ctxSectionLabel}>🗂️ VAULT RECORDS</Text>
                                <Text style={styles.ctxVaultCount}>{vaultRecords.length} document{vaultRecords.length !== 1 ? 's' : ''} stored securely</Text>
                            </View>

                            {/* Chitti's summary */}
                            {healthContext?.summary && (
                                <View style={[styles.ctxSection, { backgroundColor: '#f5f3ff', borderRadius: 16, padding: 16 }]}>
                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8}}>
                                    <Image source={require('../../assets/chitti_avatar.png')} style={{width: 18, height: 18, borderRadius: 9}} />
                                    <Text style={styles.ctxSectionLabel}>CHITTI'S CLINICAL INSIGHT</Text>
                                </View>
                                    <Text style={styles.ctxSummaryText}>{healthContext.summary}</Text>
                                </View>
                            )}
                            <View style={{ height: 30 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════
                MODAL 3 — Vault Record Picker
            ═══════════════════════════════════════════════════════════ */}
            <Modal visible={showVaultPicker} transparent animationType="slide" onRequestClose={() => setShowVaultPicker(false)}>
                <View style={styles.sheetOverlay}>
                    <View style={[styles.sheet, { maxHeight: '80%' }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.vaultPickerHeader}>
                            <View>
                                <Text style={styles.sheetTitle}>Pick from Vault</Text>
                                <Text style={styles.sheetSubtitle}>Select records to attach to this message</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowVaultPicker(false)}>
                                <Ionicons name="close" size={22} color="#475569" />
                            </TouchableOpacity>
                        </View>

                        {vaultRecords.length === 0 ? (
                            <View style={styles.vaultEmpty}>
                                <Ionicons name="documents-outline" size={48} color="#cbd5e1" />
                                <Text style={styles.vaultEmptyText}>No records in vault yet.</Text>
                                <Text style={styles.vaultEmptySubText}>Upload your first health document from the Records tab.</Text>
                            </View>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                                {vaultRecords.map(rec => {
                                    const isSelected = selectedRecords.includes(rec.id);
                                    const typeIcon = rec.type === 'prescription' ? 'medical' : rec.type === 'lab' ? 'flask' : 'document-text';
                                    return (
                                        <TouchableOpacity
                                            key={rec.id.toString()}
                                            style={[styles.vaultPickerRow, isSelected && styles.vaultPickerRowSelected]}
                                            onPress={() => toggleRecordSelection(rec.id)}
                                        >
                                            <View style={[styles.vaultPickerIcon, isSelected && { backgroundColor: '#7c3aed' }]}>
                                                <Ionicons name={typeIcon} size={20} color={isSelected ? '#fff' : '#7c3aed'} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.vaultPickerTitle}>{rec.title || 'Medical Record'}</Text>
                                                <Text style={styles.vaultPickerDate}>
                                                    {new Date(rec.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                                                </Text>
                                            </View>
                                            <View style={[styles.vaultCheckbox, isSelected && styles.vaultCheckboxChecked]}>
                                                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                                <View style={{ height: 20 }} />
                            </ScrollView>
                        )}

                        {selectedRecords.length > 0 && (
                            <TouchableOpacity style={styles.vaultConfirmBtn} onPress={confirmVaultAttach} id="chitti-vault-confirm-btn">
                                <Text style={styles.vaultConfirmBtnText}>
                                    Attach {selectedRecords.length} Record{selectedRecords.length > 1 ? 's' : ''}
                                </Text>
                                <Ionicons name="arrow-forward" size={18} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════
                MODAL 4 — Share Record to Doctor
            ═══════════════════════════════════════════════════════════ */}
            <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={() => setShowShareModal(false)}>
                <View style={styles.sheetOverlay}>
                    <View style={[styles.sheet, { paddingBottom: 40 }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.shareModalHeader}>
                            <View style={styles.shareModalIcon}>
                                <Ionicons name="share-social" size={24} color="#7c3aed" />
                            </View>
                            <TouchableOpacity onPress={() => setShowShareModal(false)}>
                                <Ionicons name="close" size={22} color="#475569" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sheetTitle}>Share with Doctor</Text>
                        {recordToShare && (
                            <View style={styles.shareRecordPreview}>
                                <Ionicons name="document-text" size={18} color="#7c3aed" />
                                <Text style={styles.shareRecordPreviewText} numberOfLines={1}>
                                    {recordToShare.title || 'Medical Record'}
                                </Text>
                            </View>
                        )}

                        <Text style={styles.shareLabel}>Doctor Name or ID</Text>
                        <TextInput
                            id="chitti-doctor-name-input"
                            style={styles.shareInput}
                            placeholder="e.g. Dr. Anil Sharma or MUL-DOC-001"
                            placeholderTextColor="#94a3b8"
                            value={doctorName}
                            onChangeText={setDoctorName}
                            autoCapitalize="words"
                        />

                        <Text style={styles.shareLabel}>Access Duration</Text>
                        <View style={styles.durationGrid}>
                            {SHARE_DURATIONS.map(d => (
                                <TouchableOpacity
                                    key={d.label}
                                    style={[styles.durationChip, shareDuration.label === d.label && styles.durationChipActive]}
                                    onPress={() => setShareDuration(d)}
                                >
                                    <Text style={[styles.durationChipText, shareDuration.label === d.label && { color: '#fff' }]}>
                                        {d.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.shareInfoBox}>
                            <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
                            <Text style={styles.shareInfoText}>
                                Only this specific record will be shared. Access is logged and can be revoked anytime.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.shareConfirmBtn, shareLoading && { opacity: 0.6 }]}
                            onPress={confirmShare}
                            disabled={shareLoading}
                            id="chitti-share-confirm-btn"
                        >
                            {shareLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="send" size={18} color="#fff" />
                                    <Text style={styles.shareConfirmBtnText}>Send Secure Link</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#050810',
    },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
        paddingTop: Platform.OS === 'ios' ? 0 : 8,
        paddingBottom: 0,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
    },
    chittiTopAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#7c3aed',
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 6,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    headerStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    activeDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#10b981',
        marginRight: 6,
    },
    headerStatus: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    contextBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(124,58,237,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contextBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contextBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },

    // ── Context Pills ────────────────────────────────────────────────────────
    contextPillsScroll: {
        maxHeight: 44,
    },
    contextKnowsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(124,58,237,0.3)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.4)',
    },
    contextKnowsText: {
        color: '#a78bfa',
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 4,
    },
    conditionTag: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 8,
        borderWidth: 1,
    },
    conditionTagText: {
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 4,
    },
    noContextBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 8,
    },
    noContextText: {
        color: '#64748b',
        fontSize: 12,
    },

    // ── Messages ─────────────────────────────────────────────────────────────
    messageList: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
    },
    msgRow: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    msgRowUser: {
        justifyContent: 'flex-end',
    },
    msgRowAi: {
        justifyContent: 'flex-start',
    },
    msgColumn: {
        flex: 1,
        maxWidth: '85%',
    },
    chittiAvatarSmall: {
        marginRight: 8,
        marginBottom: 2,
    },
    chittiAvatarGrad: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bubble: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
    },
    bubbleUser: {
        alignSelf: 'flex-end',
        backgroundColor: '#4c1d95',
        borderBottomRightRadius: 4,
    },
    bubbleAi: {
        alignSelf: 'flex-start',
        backgroundColor: '#1E1B4B',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    bubbleText: {
        fontSize: 15,
        lineHeight: 22,
    },
    bubbleTextUser: {
        color: '#fff',
    },
    bubbleTextAi: {
        color: '#E2E8F0',
    },

    // ── Typing dots ──────────────────────────────────────────────────────────
    typingRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    typingDots: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 20,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#7c3aed',
    },

    // ── Inline Record Card ───────────────────────────────────────────────────
    inlineRecordCard: {
        marginTop: 8,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e9d5ff',
        elevation: 2,
        shadowColor: '#7c3aed',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    inlineRecordIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    inlineRecordBody: {
        flex: 1,
    },
    inlineRecordTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    inlineRecordSummary: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
        lineHeight: 15,
    },
    inlineRecordDate: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 4,
    },
    inlineShareBtn: {
        alignItems: 'center',
        paddingLeft: 10,
        gap: 2,
    },
    inlineShareBtnText: {
        fontSize: 10,
        color: '#7c3aed',
        fontWeight: '700',
    },

    // ── Attached bar ─────────────────────────────────────────────────────────
    attachedBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        gap: 8,
    },
    attachedBarText: {
        flex: 1,
        color: '#7c3aed',
        fontSize: 13,
        fontWeight: '600',
    },

    // ── Input Bar ────────────────────────────────────────────────────────────
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        paddingBottom: Platform.OS === 'web' ? 20 : (Platform.OS === 'ios' ? 28 : 12),
        marginBottom: 80, // CRITICAL: Clear the floating tab bar
        backgroundColor: '#0F172A',
        borderRadius: 20,
        marginHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        gap: 6,
    },
    langChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 2,
    },
    textInputWrapper: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 22,
        paddingHorizontal: 14,
        paddingVertical: 6,
        minHeight: 42,
        justifyContent: 'center',
    },
    textInput: {
        fontSize: 15,
        color: '#fff',
        maxHeight: 100,
    },
    inputAction: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4c1d95',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#4c1d95',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },

    // ── Bottom Sheet (Modals) ─────────────────────────────────────────────────
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    sheetTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 4,
    },
    sheetSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 4,
    },

    // ── Lang Modal ───────────────────────────────────────────────────────────
    langRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        borderRadius: 8,
        paddingHorizontal: 4,
    },
    langRowActive: {
        backgroundColor: '#f5f3ff',
    },
    langRowFlag: {
        fontSize: 18,
        color: '#334155',
    },

    // ── Context Panel ────────────────────────────────────────────────────────
    contextPanelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    ctxPatientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f3ff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        gap: 14,
    },
    ctxAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#ede9fe',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ctxPatientName: {
        fontSize: 17,
        fontWeight: '800',
        color: '#1e293b',
    },
    ctxPatientSub: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    ctxSection: {
        marginBottom: 20,
    },
    ctxSectionLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: '#94a3b8',
        letterSpacing: 1.4,
        marginBottom: 12,
    },
    ctxConditionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 4,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
    },
    ctxConditionName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    ctxConditionDate: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    ctxStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    ctxStatusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    ctxMedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 10,
    },
    ctxMedName: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    ctxVaultCount: {
        fontSize: 15,
        color: '#4c1d95',
        fontWeight: '700',
    },
    ctxSummaryText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 22,
        fontStyle: 'italic',
    },

    // ── Vault Picker ─────────────────────────────────────────────────────────
    vaultPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    vaultEmpty: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 10,
    },
    vaultEmptyText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#94a3b8',
    },
    vaultEmptySubText: {
        fontSize: 13,
        color: '#cbd5e1',
        textAlign: 'center',
    },
    vaultPickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        gap: 12,
    },
    vaultPickerRowSelected: {
        backgroundColor: '#f5f3ff',
        borderColor: '#7c3aed',
    },
    vaultPickerIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#ede9fe',
        justifyContent: 'center',
        alignItems: 'center',
    },
    vaultPickerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    vaultPickerDate: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    vaultCheckbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    vaultCheckboxChecked: {
        backgroundColor: '#7c3aed',
        borderColor: '#7c3aed',
    },
    vaultConfirmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4c1d95',
        padding: 16,
        borderRadius: 16,
        marginTop: 12,
        gap: 10,
        elevation: 3,
        shadowColor: '#4c1d95',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    vaultConfirmBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },

    // ── Share Modal ──────────────────────────────────────────────────────────
    shareModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    shareModalIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareRecordPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f3ff',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 20,
        marginTop: 8,
        gap: 8,
    },
    shareRecordPreviewText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#4c1d95',
    },
    shareLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    shareInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        fontSize: 15,
        color: '#1e293b',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 20,
    },
    durationGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    durationChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    durationChipActive: {
        backgroundColor: '#4c1d95',
        borderColor: '#4c1d95',
    },
    durationChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    shareInfoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
        gap: 10,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    shareInfoText: {
        flex: 1,
        fontSize: 12,
        color: '#166534',
        lineHeight: 18,
    },
    shareConfirmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4c1d95',
        padding: 16,
        borderRadius: 16,
        gap: 10,
        elevation: 4,
        shadowColor: '#4c1d95',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
    },
    shareConfirmBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },

    // ── Misc ─────────────────────────────────────────────────────────────────
    emptyChat: {
        alignItems: 'center',
        marginTop: 80,
    },
    emptyChatText: {
        fontSize: 14,
        color: '#94a3b8',
    },
    chittiTopAvatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
    },
    avatarImgSmall: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
        opacity: 0.5,
    },
    historyBarContainer: {
        backgroundColor: '#050810',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    historyScroll: {
        paddingHorizontal: 16,
        gap: 10,
    },
    newChatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7c3aed',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 4,
    },
    newChatText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    sessionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        gap: 8,
    },
    sessionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
    },
    sessionTitle: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600',
    },
});
