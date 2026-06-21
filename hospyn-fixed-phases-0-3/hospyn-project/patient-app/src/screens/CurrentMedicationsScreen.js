import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import { SecurityUtils } from '../utils/security';
import { Theme, GlobalStyles } from '../theme';

export default function CurrentMedicationsScreen({ navigation, route }) {
    const [meds, setMeds] = useState([]);
    const [currentMed, setCurrentMed] = useState('');

    const addMed = () => {
        if (!currentMed) return;
        setMeds([...meds, currentMed]);
        setCurrentMed('');
    };

    const removeMed = (index) => {
        setMeds(meds.filter((_, i) => i !== index));
    };

    const handleFinish = async () => {
        try {
            const fullName = route.params?.fullName || "";
            const names = fullName.split(" ");
            const firstName = names[0] || "Unknown";
            const lastName = names.length > 1 ? names.slice(1).join(" ") : "";

            const payload = {
                phone_number: route.params?.phone || "",
                first_name: firstName,
                last_name: lastName,
                date_of_birth: route.params?.age ? String(route.params.age) : "0",
                gender: route.params?.gender || "Unknown",
                blood_group: route.params?.bloodGroup || "Unknown",
                conditions: route.params?.conditions || [],
                medications: meds
            };

            const response = await axios.post(`${API_BASE_URL}/profile/setup`, payload);

            if (response.data && response.data.access_token) {
                await SecurityUtils.saveToken(response.data.access_token);
                await SecurityUtils.saveHospynId(response.data.hospyn_id || '');
                navigation.replace('MainTabs');
            } else {
                Alert.alert("Error", "Registration failed. No token received.");
            }
        } catch (error) {
            console.error('Registration Error:', error);
            Alert.alert("Error", "Could not complete registration.");
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: Theme.colors.background }]}>
            <LinearGradient colors={['#050810', '#1E1B4B']} style={styles.header}>
                <Text style={[styles.headerTitle, GlobalStyles.heading]}>Current Medications</Text>
                <Text style={styles.headerSubtitle}>Do you take any daily medicines?</Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.inputRow}>
                    <TextInput
                        style={[styles.input, { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff' }]}
                        placeholder="Medicine name (e.g. Lipitor)"
                        placeholderTextColor="#94A3B8"
                        value={currentMed}
                        onChangeText={setCurrentMed}
                    />
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: Theme.colors.primary }]} onPress={addMed}>
                        <Ionicons name="add" size={30} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.list}>
                    {meds.map((m, i) => (
                        <View key={i} style={[styles.medItem, GlobalStyles.glass, { marginBottom: 10 }]}>
                            <View style={[styles.medIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                                <Ionicons name="medkit-outline" size={20} color={Theme.colors.primary} />
                            </View>
                            <Text style={[styles.medText, { color: '#fff' }]}>{m}</Text>
                            <TouchableOpacity onPress={() => removeMed(i)}>
                                <Ionicons name="trash-outline" size={20} color="#dc2626" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={[styles.button, { backgroundColor: Theme.colors.primary }]} onPress={handleFinish}>
                    <Text style={styles.buttonText}>Finish Setup</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginLeft: 10 }} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={handleFinish}>
                    <Text style={styles.skipText}>I'll add them later</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 40, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerTitle: { color: '#fff', fontSize: 24 },
    headerSubtitle: { color: '#94A3B8', fontSize: 14, marginTop: 5 },
    content: { padding: 25 },
    inputRow: { flexDirection: 'row', marginBottom: 25 },
    input: { flex: 1, borderRadius: 12, padding: 15, fontSize: 16, marginRight: 10 },
    addButton: { width: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    list: { marginBottom: 30 },
    medItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 12,
    },
    medIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    medText: { flex: 1, fontSize: 15, fontWeight: '600' },
    button: {
        height: 55,
        borderRadius: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    skipButton: { marginTop: 20, alignItems: 'center' },
    skipText: { color: '#94A3B8', fontSize: 14 },
});
