import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Alert, Modal, View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { WS_BASE_URL } from '../api';
import { useAuth } from './AuthContext';
import { SecurityUtils } from '../utils/security';
import { clinicalService } from '../services/clinicalService';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { isAuthenticated, authProvider } = useAuth();
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const reconnectTimer = useRef(null);
    const MAX_RETRIES = 5;

    // Consent Flow State
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [consentData, setConsentData] = useState(null);
    const [records, setRecords] = useState([]);
    const [selectedRecords, setSelectedRecords] = useState([]);
    const [isFetchingRecords, setIsFetchingRecords] = useState(false);
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Expose Global Consent Modal Trigger
    const openConsentModal = async (data) => {
        if (!data || showConsentModal) return;
        console.log('[Socket] Opening global consent modal for doctor:', data.doctor_name);
        setConsentData(data);
        setShowConsentModal(true);
        setIsFetchingRecords(true);
        try {
            const fetched = await clinicalService.getRecords();
            setRecords(fetched || []);
            // Check all records by default for quick checkout
            setSelectedRecords((fetched || []).map(r => r.id));
        } catch (recErr) {
            console.error('[Socket] Failed to fetch patient records for consent:', recErr);
        } finally {
            setIsFetchingRecords(false);
        }
    };

    // Connect/Disconnect based on global Auth State
    useEffect(() => {
        if (isAuthenticated) {
            connect();
        } else {
            if (socket) {
                socket.close();
                setSocket(null);
            }
        }
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        };
    }, [isAuthenticated]);

    // ROBUST FALLBACK POLLING: Poll for pending access requests every 10 seconds
    useEffect(() => {
        let intervalId = null;

        const checkPendingAccess = async () => {
            if (!isAuthenticated || showConsentModal) return;
            try {
                const pending = await clinicalService.getPendingAccess();
                if (pending && pending.length > 0) {
                    console.log('[Socket Poller] Detected pending access request via poll. Triggering modal.');
                    const firstRequest = pending[0];
                    await openConsentModal(firstRequest);
                }
            } catch (err) {
                console.warn('[Socket Poller] Failed to check pending access:', err.message || err);
            }
        };

        if (isAuthenticated) {
            // Check immediately on mount/auth state change
            checkPendingAccess();
            // Start periodic safety poll
            intervalId = setInterval(checkPendingAccess, 10000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isAuthenticated, showConsentModal]);

    const connect = async () => {
        const latestToken = await SecurityUtils.getToken();

        if (!latestToken) {
            console.log('[Socket] No session token, skipping connection.');
            return;
        }

        if (socket && socket.readyState <= 1) {
            return;
        }

        if (retryCount >= MAX_RETRIES) {
            console.warn('[Socket] Max retries reached.');
            return;
        }

        console.log(`[Socket] Connecting to bridge... (Attempt ${retryCount + 1})`);

        try {
            const ws = new WebSocket(`${WS_BASE_URL}/ws`);

            ws.onopen = () => {
                console.log('[Socket] Hospain WebSocket Connected ✅. Performing handshake...');
                ws.send(JSON.stringify({ type: 'auth', token: latestToken }));
                setSocket(ws);
                setRetryCount(0);
            };

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[Socket] Event:', data.type);
                    if (data.type === 'consent_request') {
                        const payload = data.payload || {};
                        await openConsentModal(payload);
                    }
                    setLastMessage(data);
                } catch (e) {
                    console.error('[Socket] Data Error:', e);
                }
            };

            ws.onclose = (e) => {
                console.log(`[Socket] Bridge closed. Code: ${e.code}`);
                setSocket(null);
                const delay = e.code === 1008 ? 30000 : 5000;
                if (latestToken) {
                    setRetryCount(prev => prev + 1);
                    reconnectTimer.current = setTimeout(connect, delay);
                }
            };

            ws.onerror = (err) => {
                console.error('[Socket] Bridge Error:', err.message || err);
            };
        } catch (err) {
            console.error('[Socket] Init Error:', err);
        }
    };

    const handleToggleRecord = (recordId) => {
        setSelectedRecords(prev => 
            prev.includes(recordId) 
                ? prev.filter(id => id !== recordId) 
                : [...prev, recordId]
        );
    };

    const handleGrantAccess = async () => {
        if (authProvider !== 'google' && !password) {
            setErrorMessage('Password verification is required.');
            return;
        }
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            await clinicalService.approveAccess(consentData.access_id, {
                record_ids: selectedRecords,
                password: password
            });
            console.log('[Socket] Access approved successfully');
            Alert.alert('Access Granted', `Dr. ${consentData.doctor_name || 'Clinician'} can now view your shared medical vault.`);
            handleCloseModal();
        } catch (err) {
            console.error('[Socket] Grant consent failed:', err);
            const msg = err.response?.data?.detail || 'Verification failed. Please check your password.';
            setErrorMessage(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectAccess = async () => {
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            await clinicalService.revokeAccess(consentData.access_id);
            console.log('[Socket] Access rejected successfully');
            Alert.alert('Access Declined', 'You have rejected this access request.');
            handleCloseModal();
        } catch (err) {
            console.error('[Socket] Reject consent failed:', err);
            const msg = err.response?.data?.detail || 'Failed to reject request. Please try again.';
            setErrorMessage(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        setShowConsentModal(false);
        setConsentData(null);
        setRecords([]);
        setSelectedRecords([]);
        setPassword('');
        setErrorMessage('');
    };

    return (
        <SocketContext.Provider value={{ socket, lastMessage, openConsentModal }}>
            {children}

            {/* Global High-Fidelity Consent Modal */}
            {consentData && (
                <Modal
                    visible={showConsentModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={handleCloseModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <View style={styles.headerWrapper}>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>SECURE GATEKEEPER</Text>
                                </View>
                                <Text style={styles.title}>Clinical Access Request</Text>
                            </View>

                            {/* Doctor Card */}
                            <View style={styles.card}>
                                <Text style={styles.doctorLabel}>Requesting Clinician</Text>
                                <Text style={styles.doctorName}>{consentData.doctor_name || 'Proctor Clinician'}</Text>
                                <Text style={styles.clinicName}>{consentData.clinic_name || 'Hospain Medical Network'}</Text>
                                <Text style={styles.timestamp}>
                                    Received: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>

                            {/* Granular Record Sharing */}
                            <Text style={styles.sectionTitle}>Select Vault Records to Share</Text>
                            
                            {isFetchingRecords ? (
                                <ActivityIndicator size="small" color="#5B9BD5" style={{ marginVertical: 15 }} />
                            ) : records.length === 0 ? (
                                <Text style={styles.emptyText}>No clinical records found in your vault.</Text>
                            ) : (
                                <ScrollView style={styles.recordList} nestedScrollEnabled={true}>
                                    {records.map(item => {
                                        const isSelected = selectedRecords.includes(item.id);
                                        return (
                                            <TouchableOpacity 
                                                key={item.id} 
                                                style={[styles.recordItem, isSelected && styles.recordItemSelected]}
                                                onPress={() => handleToggleRecord(item.id)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                                                </View>
                                                <View style={styles.recordInfo}>
                                                    <Text style={styles.recordName} numberOfLines={1}>{item.record_name}</Text>
                                                    <Text style={styles.recordMeta}>{item.type} • {item.hospital_name}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}

                            {/* Credentials Verification (Skip for Google Users) */}
                            {authProvider !== 'google' && (
                                <>
                                    <Text style={styles.sectionTitle}>Confirm Vault Credentials</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter password to verify vault keys"
                                        placeholderTextColor="#64748B"
                                        secureTextEntry={true}
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                </>
                            )}

                            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                            {/* Actions */}
                            <View style={styles.btnContainer}>
                                <TouchableOpacity 
                                    style={styles.btnDecline} 
                                    onPress={handleRejectAccess}
                                    disabled={isSubmitting}
                                >
                                    <Text style={styles.btnDeclineText}>Decline</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.btnGrant} 
                                    onPress={handleGrantAccess}
                                    disabled={isSubmitting || (records.length > 0 && selectedRecords.length === 0)}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.btnGrantText}>Grant Access</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </SocketContext.Provider>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContainer: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#0A0F1E',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
        shadowColor: '#5B9BD5',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 10
    },
    headerWrapper: {
        alignItems: 'center',
        marginBottom: 20
    },
    badge: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 10
    },
    badgeText: {
        color: '#5B9BD5',
        fontWeight: 'bold',
        fontSize: 10,
        letterSpacing: 1
    },
    title: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 28
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)'
    },
    doctorLabel: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    doctorName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 4
    },
    clinicName: {
        color: '#5B9BD5',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2
    },
    timestamp: {
        color: '#64748B',
        fontSize: 11,
        marginTop: 8,
        fontStyle: 'italic'
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    recordList: {
        maxHeight: 180,
        marginBottom: 20
    },
    recordItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.01)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.03)'
    },
    recordItemSelected: {
        backgroundColor: 'rgba(99, 102, 241, 0.06)',
        borderColor: 'rgba(99, 102, 241, 0.25)'
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: '#475569',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    checkboxSelected: {
        borderColor: '#5B9BD5',
        backgroundColor: '#5B9BD5'
    },
    checkmark: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold'
    },
    recordInfo: {
        flex: 1
    },
    recordName: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600'
    },
    recordMeta: {
        color: '#64748B',
        fontSize: 11,
        marginTop: 2
    },
    emptyText: {
        color: '#64748B',
        fontSize: 12,
        textAlign: 'center',
        marginVertical: 15
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
        padding: 12,
        color: '#FFFFFF',
        fontSize: 14,
        marginBottom: 10
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 15,
        textAlign: 'center'
    },
    btnContainer: {
        flexDirection: 'row',
        gap: 12
    },
    btnDecline: {
        flex: 1,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.15)'
    },
    btnDeclineText: {
        color: '#EF4444',
        fontWeight: 'bold',
        fontSize: 14
    },
    btnGrant: {
        flex: 1,
        backgroundColor: '#5B9BD5',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: '#5B9BD5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8
    },
    btnGrantText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14
    }
});
