import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { SecurityUtils } from '../utils/security';

import { API_BASE_URL } from '../api';

const LANGUAGES = [
    { id: 'en-IN', name: 'English', flag: '🇬🇧' },
    { id: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
    { id: 'te-IN', name: 'తెలుగు', flag: '🇮🇳' },
    { id: 'ta-IN', name: 'தமிழ்', flag: '🇮🇳' },
    { id: 'kn-IN', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

export default function ChittiAiScreen() {
    const [messages, setMessages] = useState([
        { id: '1', sender: 'ai', text: 'Hi! I am Chitti. How can I help you with your health today?' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [selectedLang, setSelectedLang] = useState('en-IN');
    const [showLangModal, setShowLangModal] = useState(false);

    const flatListRef = useRef();

    useEffect(() => {
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
                }
            } catch (e) {
                console.log("History fetch failed", e);
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
                if (Platform.OS === 'web') {
                    const response = await fetch(imageFile.uri);
                    const blob = await response.blob();
                    formData.append('file', blob, 'chat_upload.jpg');
                } else {
                    formData.append('file', {
                        uri: imageFile.uri,
                        name: 'chat_upload.jpg',
                        type: 'image/jpeg'
                    });
                }
            }

            const response = await axios.post(`${API_BASE_URL}/patient/chat`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const aiMsg = { id: (Date.now() + 1).toString(), sender: 'ai', text: response.data.ai_text };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg = { id: (Date.now() + 1).toString(), sender: 'ai', text: 'Oops! I had a little hiccup. Can you try saying that again?' };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            sendMessage(null, null, result.assets[0]);
        }
    };

    const startRecording = async () => {
        try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false
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
        <View style={[styles.messageBubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.messageText, item.sender === 'user' ? styles.userText : styles.aiText]}>
                {item.text}
            </Text>
        </View>
    );

    const CurrentLang = LANGUAGES.find(l => l.id === selectedLang);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : null}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
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
                    <ActivityIndicator size="small" color="#4c1d95" />
                    <Text style={styles.typingText}>Chitti is thinking in {CurrentLang.name}...</Text>
                </View>
            )}

            <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                    <TouchableOpacity style={styles.langInside} onPress={() => setShowLangModal(true)}>
                        <Text style={{ fontSize: 22 }}>{CurrentLang.flag}</Text>
                        <Ionicons name="chevron-down" size={12} color="#64748b" />
                    </TouchableOpacity>

                    <TextInput
                        style={styles.input}
                        placeholder={`Ask your friend Chitti...`}
                        placeholderTextColor="#94a3b8"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />

                    <TouchableOpacity style={styles.actionIcon} onPress={pickImage}>
                        <Ionicons name="image-outline" size={24} color="#4c1d95" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionIcon, { marginLeft: 5 }]} onPress={pickImage}>
                        <Ionicons name="document-text-outline" size={24} color="#4c1d95" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.micButton, isRecording && styles.micActive]}
                    onLongPress={startRecording}
                    onPressOut={stopRecording}
                >
                    <Ionicons name={isRecording ? "mic" : "mic-outline"} size={26} color="#fff" />
                </TouchableOpacity>

                {inputText.length > 0 && (
                    <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage(inputText)}>
                        <Ionicons name="send" size={24} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            <Modal visible={showLangModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Choose Language</Text>
                        {LANGUAGES.map(lang => (
                            <TouchableOpacity
                                key={lang.id}
                                style={[styles.langOption, selectedLang === lang.id && styles.langOptionActive]}
                                onPress={() => { setSelectedLang(lang.id); setShowLangModal(false); }}
                            >
                                <Text style={styles.langText}>{lang.flag} {lang.name}</Text>
                                {selectedLang === lang.id && <Ionicons name="checkmark-circle" size={24} color="#4c1d95" />}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.closeButton} onPress={() => setShowLangModal(false)}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    messageBubble: {
        maxWidth: '85%',
        padding: 15,
        borderRadius: 20,
        marginBottom: 15,
        elevation: 1,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#4c1d95',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userText: {
        color: '#fff',
    },
    aiText: {
        color: '#1e293b',
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    typingText: {
        marginLeft: 10,
        fontSize: 13,
        color: '#64748b',
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#fff',
        paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 25,
        paddingHorizontal: 12,
        marginRight: 8,
    },
    langInside: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 8,
        borderRightWidth: 1,
        borderRightColor: '#cbd5e1',
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 16,
        color: '#1e293b',
        maxHeight: 100,
    },
    actionIcon: {
        padding: 5,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#4c1d95',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        marginLeft: 8,
    },
    micButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#7c3aff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    micActive: {
        backgroundColor: '#ef4444',
    },
    iconButton: {
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 24,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 25,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 20,
        textAlign: 'center',
    },
    langOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    langOptionActive: {
        backgroundColor: '#f8fafc',
    },
    langText: {
        fontSize: 18,
        color: '#334155',
    },
    closeButton: {
        marginTop: 20,
        backgroundColor: '#f1f5f9',
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 16,
    },
});
