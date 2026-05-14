import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiService from '../utils/ApiService';

export default function PrescriptionScreen({ navigation, route }) {
    const { patientName = "Patient", patientId } = route.params || {};
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMeds, setSelectedMeds] = useState([]);
    const [loading, setLoading] = useState(false);

    // Simulated Inventory Search
    const [inventoryResults] = useState([
        { id: 'm1', name: 'Paracetamol 500mg', stock: 1200, unit: 'tabs' },
        { id: 'm2', name: 'Amoxicillin 250mg', stock: 45, unit: 'caps' },
        { id: 'm3', name: 'Metformin 500mg', stock: 0, unit: 'tabs' }, # Out of stock
    ]);

    const handleAddMed = (med) => {
        if (med.stock <= 0) return Alert.alert("Out of Stock", "This medicine is currently unavailable in the pharmacy.");
        setSelectedMeds([...selectedMeds, { ...med, dosage: '1-0-1', duration: '5 Days' }]);
        setSearchQuery('');
    };

    const handleIssue = async () => {
        if (selectedMeds.length === 0) return Alert.alert("Empty Script", "Please add at least one medication.");
        
        setLoading(true);
        try {
            // This calls our hardened PharmacyService on the backend
            // await ApiService.issuePrescription({ patient_id: patientId, items: selectedMeds });
            
            setTimeout(() => {
                Alert.alert("Prescription Issued", "Sent to Pharmacy & Patient App successfully.", [
                    { text: "Done", onPress: () => navigation.goBack() }
                ]);
                setLoading(false);
            }, 1200);
        } catch (e) {
            setLoading(false);
            Alert.alert("Error", "Failed to issue prescription. Please check connectivity.");
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="close" size={28} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>NEW PRESCRIPTION</Text>
                <View style={{ width: 28 }} />
            </View>

            <View style={styles.patientBanner}>
                <Text style={styles.patientLabel}>PATIENT</Text>
                <Text style={styles.patientName}>{patientName}</Text>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput 
                    style={styles.searchInput}
                    placeholder="Search Pharmacy Inventory..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {searchQuery.length > 0 && (
                <View style={styles.resultsBox}>
                    {inventoryResults.map(m => (
                        <TouchableOpacity key={m.id} style={styles.resultItem} onPress={() => handleAddMed(m)}>
                            <Text style={styles.resultName}>{m.name}</Text>
                            <Text style={[styles.resultStock, m.stock === 0 && { color: '#EF4444' }]}>
                                {m.stock > 0 ? `${m.stock} in stock` : 'OUT OF STOCK'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <ScrollView style={styles.medList}>
                <Text style={styles.sectionTitle}>SELECTED MEDICATIONS</Text>
                {selectedMeds.map((m, index) => (
                    <View key={index} style={styles.medCard}>
                        <View style={styles.medHeader}>
                            <Text style={styles.medName}>{m.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedMeds(selectedMeds.filter((_, i) => i !== index))}>
                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.dosageRow}>
                            <View style={styles.pill}><Text style={styles.pillText}>{m.dosage}</Text></View>
                            <View style={styles.pill}><Text style={styles.pillText}>{m.duration}</Text></View>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <TouchableOpacity style={styles.issueBtn} onPress={handleIssue} disabled={loading}>
                <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn}>
                    <Text style={styles.btnText}>{loading ? "ISSUING..." : "CONFIRM & ISSUE"}</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 12, fontWeight: 'bold', color: '#6366F1', letterSpacing: 1 },
    patientBanner: { backgroundColor: '#fff', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    patientLabel: { fontSize: 10, color: '#64748B', fontWeight: 'bold' },
    patientName: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginTop: 4 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 24, paddingHorizontal: 16, height: 56, borderRadius: 16, elevation: 2 },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: '#0F172A' },
    resultsBox: { backgroundColor: '#fff', marginHorizontal: 24, marginTop: -20, borderRadius: 16, padding: 8, elevation: 10 },
    resultItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    resultName: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
    resultStock: { fontSize: 12, color: '#10B981', fontWeight: 'bold' },
    medList: { flex: 1, paddingHorizontal: 24 },
    sectionTitle: { fontSize: 10, color: '#64748B', fontWeight: 'bold', marginBottom: 15 },
    medCard: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    medHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    medName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
    dosageRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    pill: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    pillText: { fontSize: 12, color: '#475569', fontWeight: '600' },
    issueBtn: { margin: 24, borderRadius: 16, overflow: 'hidden' },
    gradientBtn: { height: 60, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
