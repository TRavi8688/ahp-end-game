import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Image, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { SecurityUtils } from '../utils/security';
import { Theme, GlobalStyles } from '../theme';
import { API_BASE_URL } from '../api';

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
        const fetchUserData = async () => {
            try {
                const token = await SecurityUtils.getToken();
                const resp = await axios.get(`${API_BASE_URL}/patient/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const name = resp.data.full_name?.split(' ')[0] || 'there';
                setUserName(name);
                
                setMessages([
                    { 
                        id: '1', 
                        sender: 'ai', 
                        text: `Namaste ${name}! 🌿 I am Chitti, your Hospyn clinical companion. I've just synced with your health dashboard. You're looking stable! Is there anything specific you'd like to discuss?` 
                    }
                ]);
            } catch (e) {
                setMessages([
                    { id: '1', sender: 'ai', text: 'Hi! I am Chitti. How can I help you with your health today?' }
                ]);
            }
        };

        const fetchHistory = async () => {
            try {
                const token = await SecurityUtils.getToken();
                const resp = await axios.get(`${API_BASE_URL}/patient/chat-history`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (resp.data.length > 0) {
                    const formatted = resp.data.map((m, i) => ({
                        id: i.toString(),
                        sender: m.sender,
                        text: m.message_text
                    }));
                    setMessages(formatted);
                } else {
                    fetchUserData();
                }
            } catch (e) {
                fetchUserData();
            }
        };
        fetchHistory();
    }, []);

    const sendMessage = async (text, audioFile = null, imageFile = null) => {
        if (!text && !audioFile && !imageFile) return;

        let displayMsg = text || (audioFile ? 'Voice Message 🎙️' : 'Sent an image 🖼️');
        const userMsg = { id: Date.now().toString(), sender: 'user', text: displayMsg };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);

        try {
            const token = await SecurityUtils.getToken();
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
                    name: 'chat_upload.jpg',
                    type: 'image/jpeg'
                });
            }

            const response = await axios.post(`${API_BASE_URL}/patient/chat`, formData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const aiMsg = { id: (Date.now() + 1).toString(), sender: 'ai', text: response.data.ai_text };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            const errorMsg = { id: (Date.now() + 1).toString(), sender: 'ai', text: 'I encountered an issue connecting to the clinical engine. Please try again.' };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const startRecording = async () => {
        try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });
            const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(recording);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        setIsRecording(false);
        if (!recording) return;
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            sendMessage(null, { uri });
            setRecording(null);
        } catch (err) {
            console.error('Failed to stop recording', err);
        }
    };

    const renderItem = ({ item }) => (
        <View style={[styles.messageRow, item.sender === 'user' ? styles.userRow : styles.aiRow]}>
            {item.sender === 'ai' && (
                <Image source={require('../../assets/chitti_avatar.png')} style={styles.chittiAvatar} />
            )}
            <View style={[styles.messageBubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.messageText, item.sender === 'user' ? styles.userText : styles.aiText]}>
                    {item.text}
                </Text>
            </View>
        </View>
    );

    const CurrentLang = LANGUAGES.find(l => l.id === selectedLang);

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#050810', '#1E1B4B']} style={StyleSheet.absoluteFill} />
            
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : null}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.header}>
                    <View style={styles.headerProfile}>
                        <Image source={require('../../assets/chitti_avatar.png')} style={styles.headerAvatar} />
                        <View>
                            <Text style={styles.headerName}>Chitti AI</Text>
                            <View style={styles.statusRow}>
                                <View style={styles.statusDot} />
                                <Text style={styles.statusText}>Clinical Core Active</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                />

                {isTyping && (
                    <View style={styles.typingContainer}>
                        <ActivityIndicator size="small" color={Theme.colors.primary} />
                        <Text style={styles.typingText}>Reviewing clinical context...</Text>
                    </View>
                )}

                <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                        <TouchableOpacity style={styles.langInside} onPress={() => setShowLangModal(true)}>
                            <Text style={{ fontSize: 20 }}>{CurrentLang.flag}</Text>
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Type a message..."
                            placeholderTextColor="#475569"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                        />
                        
                        <TouchableOpacity style={styles.actionIcon} onPress={() => {}}>
                            <Ionicons name="camera-outline" size={24} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.micButton, isRecording && styles.micActive]}
                        onLongPress={startRecording}
                        onPressOut={stopRecording}
                    >
                        <Ionicons name={isRecording ? "mic" : "mic-outline"} size={24} color="#fff" />
                    </TouchableOpacity>

                    {inputText.length > 0 && (
                        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage(inputText)}>
                            <Ionicons name="send" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>

            <Modal visible={showLangModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Switch Context Language</Text>
                        {LANGUAGES.map(lang => (
                            <TouchableOpacity
                                key={lang.id}
                                style={[styles.langOption, selectedLang === lang.id && styles.langOptionActive]}
                                onPress={() => { setSelectedLang(lang.id); setShowLangModal(false); }}
                            >
                                <Text style={styles.langText}>{lang.flag} {lang.name}</Text>
                                {selectedLang === lang.id && <Ionicons name="checkmark-circle" size={24} color={Theme.colors.primary} />}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.closeButton} onPress={() => setShowLangModal(false)}>
                            <Text style={styles.closeButtonText}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050810',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        paddingHorizontal: 25,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    headerProfile: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    headerName: {
        color: '#fff',
        fontSize: 18,
        fontFamily: Theme.fonts.headingSemi,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
        marginRight: 6,
    },
    statusText: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: Theme.fonts.label,
        letterSpacing: 1,
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-end',
    },
    userRow: {
        justifyContent: 'flex-end',
    },
    aiRow: {
        justifyContent: 'flex-start',
    },
    chittiAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 10,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 16,
        borderRadius: 24,
    },
    userBubble: {
        backgroundColor: Theme.colors.primary,
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 24,
        fontFamily: Theme.fonts.body,
    },
    userText: {
        color: '#fff',
    },
    aiText: {
        color: '#E2E8F0',
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 25,
        marginBottom: 15,
    },
    typingText: {
        marginLeft: 12,
        fontSize: 12,
        color: '#64748b',
        fontFamily: Theme.fonts.label,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        backgroundColor: 'rgba(5, 8, 16, 0.95)',
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        paddingBottom: Platform.OS === 'ios' ? 40 : 15,
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        paddingHorizontal: 15,
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    langInside: {
        paddingRight: 10,
        borderRightWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#FFFFFF',
        fontFamily: Theme.fonts.body,
        maxHeight: 120,
    },
    actionIcon: {
        padding: 5,
    },
    micButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micActive: {
        backgroundColor: '#EF4444',
    },
    sendButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#0F172A',
        borderRadius: 32,
        padding: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: {
        fontSize: 22,
        fontFamily: Theme.fonts.headingSemi,
        color: '#FFFFFF',
        marginBottom: 25,
        textAlign: 'center',
    },
    langOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    langText: {
        fontSize: 18,
        color: '#E2E8F0',
        fontFamily: Theme.fonts.body,
    },
    closeButton: {
        marginTop: 25,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 18,
        borderRadius: 18,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#94A3B8',
        fontFamily: Theme.fonts.headingSemi,
        fontSize: 16,
    },
});
