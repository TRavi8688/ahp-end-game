const fs = require('fs');

let content = fs.readFileSync('patient-app/src/screens/PrescriptionDetailScreen.js', 'utf8');

const newImports = `import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import ApiService from '../utils/ApiService';`;

content = content.replace("import React from 'react';", newImports);

const modalState = `    const { prescription } = route.params;
    const [showShareModal, setShowShareModal] = useState(false);
    const [pharmacyId, setPharmacyId] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const shareExternally = async () => {
        try {
            const medList = prescription.medications.map(m => \`- \${m.name} (\${m.dosage})\`).join('\\n');
            const message = \`Digital Prescription from Hospyn\\n\\nDiagnosis: \${prescription.diagnosis}\\nDate: \${new Date(prescription.created_at).toLocaleDateString()}\\n\\nMedications:\\n\${medList}\\n\\nRef: \${prescription.id}\`;
            await Share.share({ message });
        } catch (error) {
            console.error(error);
        }
    };

    const shareInternally = async () => {
        if (!pharmacyId) return Alert.alert('Error', 'Please enter a Pharmacy ID');
        setIsSharing(true);
        try {
            await ApiService.post(\`/clinical/prescriptions/\${prescription.id}/share\`, { pharmacy_id: pharmacyId });
            setShowShareModal(false);
            Alert.alert('Success', 'Prescription securely shared with Pharmacy!');
        } catch (error) {
            Alert.alert('Error', 'Failed to share. Make sure the Pharmacy ID is correct.');
        } finally {
            setIsSharing(false);
        }
    };`;

content = content.replace("    const { prescription } = route.params;", modalState);

const shareButtons = `                <View style={styles.footer}>
                    <Text style={styles.footerText}>THIS IS A DIGITALLY SIGNED CLINICAL ORDER</Text>
                    <Text style={styles.footerId}>REF: {prescription.id.substring(0, 8).toUpperCase()}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
                    <TouchableOpacity style={styles.actionBtnSecondary} onPress={shareExternally}>
                        <Ionicons name="share-outline" size={20} color="#6366F1" />
                        <Text style={styles.actionBtnTextSecondary}>SHARE EXTERNALLY</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setShowShareModal(true)}>
                        <Ionicons name="qr-code-outline" size={20} color="#fff" />
                        <Text style={styles.actionBtnTextPrimary}>HOSPYN PHARMACY</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            <Modal visible={showShareModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>SHARE WITH PHARMACY</Text>
                            <TouchableOpacity onPress={() => setShowShareModal(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSub}>Enter the Pharmacy's Hospyn ID to instantly beam this prescription.</Text>
                        
                        <TextInput 
                            style={styles.input} 
                            placeholder="e.g. Hospyn-PHARMA-123" 
                            placeholderTextColor="#64748B"
                            value={pharmacyId}
                            onChangeText={setPharmacyId}
                        />
                        
                        <TouchableOpacity style={styles.sendBtn} onPress={shareInternally} disabled={isSharing}>
                            {isSharing ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>BEAM PRESCRIPTION</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
`;

content = content.replace(/                <View style=\{styles.footer\}>[\s\S]*?<\/View>\r?\n            <\/ScrollView>/, shareButtons);

const newStyles = `    actionBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)' },
    actionBtnTextSecondary: { color: '#6366F1', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    actionBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#6366F1' },
    actionBtnTextPrimary: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#0F172A', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 50 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    modalSub: { color: '#94A3B8', fontSize: 14, marginBottom: 20, lineHeight: 22 },
    input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#fff', padding: 16, borderRadius: 16, fontSize: 16, marginBottom: 20 },
    sendBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 16, alignItems: 'center' },
    sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 }
});`;

content = content.replace("});", newStyles);

fs.writeFileSync('patient-app/src/screens/PrescriptionDetailScreen.js', content);
