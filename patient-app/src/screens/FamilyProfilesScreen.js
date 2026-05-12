import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, TextInput, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import { Theme, GlobalStyles } from '../theme';
import ApiService from '../utils/ApiService';

export default function FamilyProfilesScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [profiles, setProfiles] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    
    const [newMember, setNewMember] = useState({
        fullName: '',
        relation: '',
        phone: '',
        dob: '',
        gender: ''
    });

    const relations = [
        "Mother", "Father", "Brother", "Sister", 
        "Husband", "Wife", "Son", "Daughter"
    ];

    useEffect(() => {
        // Fetch existing family profiles
        // setProfiles([...]);
    }, []);

    const handleAddMember = async () => {
        if (!newMember.fullName || !newMember.relation) {
            return Alert.alert("Missing Info", "Please provide name and relationship.");
        }
        
        setLoading(true);
        try {
            // Simulated success for now
            setTimeout(() => {
                Alert.alert("Success", `${newMember.fullName} has been added to your Care Circle.`);
                setProfiles([...profiles, { ...newMember, id: Date.now().toString() }]);
                setIsAdding(false);
                setNewMember({ fullName: '', relation: '', phone: '', dob: '', gender: '' });
                setLoading(false);
            }, 1000);
        } catch (e) {
            Alert.alert("Error", "Failed to add family member.");
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#050810', '#1E1B4B', '#050810']} style={StyleSheet.absoluteFill} />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>CARE CIRCLE</Text>
                <TouchableOpacity onPress={() => setIsAdding(!isAdding)}>
                    <Ionicons name={isAdding ? "close" : "add"} size={28} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {isAdding ? (
                    <View style={styles.addCard}>
                        <Text style={styles.cardTitle}>Add Family Member</Text>
                        <Text style={styles.cardSubtitle}>Extend your clinical blood-line circle.</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>RELATIONSHIP</Text>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={newMember.relation}
                                    onValueChange={(v) => setNewMember({...newMember, relation: v})}
                                    style={styles.picker}
                                    dropdownIconColor="#94A3B8"
                                >
                                    <Picker.Item label="Select Relation" value="" />
                                    {relations.map(r => <Picker.Item key={r} label={r} value={r} />)}
                                </Picker>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>FULL NAME</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter Name"
                                    placeholderTextColor="#475569"
                                    value={newMember.fullName}
                                    onChangeText={(v) => setNewMember({...newMember, fullName: v})}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>MOBILE (OPTIONAL)</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="For coordinated alerts"
                                    placeholderTextColor="#475569"
                                    keyboardType="phone-pad"
                                    value={newMember.phone}
                                    onChangeText={(v) => setNewMember({...newMember, phone: v})}
                                />
                            </View>
                        </View>

                        <TouchableOpacity style={styles.submitBtn} onPress={handleAddMember} disabled={loading}>
                            <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.gradientBtn}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Add to Circle</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.profilesList}>
                        {profiles.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="people-outline" size={60} color="rgba(255,255,255,0.1)" />
                                <Text style={styles.emptyText}>Your Care Circle is empty.</Text>
                                <TouchableOpacity style={styles.emptyBtn} onPress={() => setIsAdding(true)}>
                                    <Text style={styles.emptyBtnText}>Start adding family</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            profiles.map(p => (
                                <View key={p.id} style={styles.profileCard}>
                                    <View style={styles.profileIcon}>
                                        <Ionicons name="person" size={24} color="#fff" />
                                    </View>
                                    <View style={styles.profileInfo}>
                                        <Text style={styles.profileName}>{p.fullName}</Text>
                                        <Text style={styles.profileRelation}>{p.relation}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.accessBtn}>
                                        <Text style={styles.accessBtnText}>Manage Records</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>

            <View style={styles.trustFooter}>
                <Ionicons name="lock-closed" size={12} color="#10b981" />
                <Text style={styles.trustText}>BLOOD-LINE COORDINATION ENCRYPTED</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050810',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: Theme.fonts.label,
        letterSpacing: 2,
        fontWeight: 'bold',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
    },
    addCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    cardSubtitle: {
        color: '#94A3B8',
        fontSize: 14,
        marginBottom: 30,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 10,
        color: '#6366F1',
        letterSpacing: 1,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    pickerWrapper: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        height: 56,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
    },
    picker: {
        color: '#FFFFFF',
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
    },
    submitBtn: {
        marginTop: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradientBtn: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    profilesList: {
        gap: 15,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    profileIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    profileRelation: {
        color: '#6366F1',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 2,
    },
    accessBtn: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    accessBtnText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: 'bold',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        color: '#475569',
        fontSize: 16,
        marginTop: 20,
    },
    emptyBtn: {
        marginTop: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    emptyBtnText: {
        color: '#6366F1',
        fontWeight: 'bold',
    },
    trustFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 20,
        backgroundColor: 'rgba(16, 185, 129, 0.03)',
    },
    trustText: {
        color: '#10b981',
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});
