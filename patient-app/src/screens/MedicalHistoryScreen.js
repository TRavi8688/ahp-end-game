import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, GlobalStyles } from '../theme';

export default function MedicalHistoryScreen({ navigation, route }) {
    const [selected, setSelected] = useState([]);

    const conditions = [
        'Diabetes', 'Hypertension', 'Asthma', 'Thyroid',
        'Heart Disease', 'Allergies', 'Arthritis', 'None'
    ];

    const toggle = (c) => {
        if (c === 'None') return setSelected(['None']);
        const newSel = selected.includes(c)
            ? selected.filter(x => x !== c)
            : [...selected.filter(x => x !== 'None'), c];
        setSelected(newSel);
    };

    return (
        <View style={[styles.container, { backgroundColor: Theme.colors.background }]}>
            <LinearGradient colors={['#050810', '#1E1B4B']} style={styles.header}>
                <Text style={[styles.headerTitle, GlobalStyles.heading]}>Medical History</Text>
                <Text style={styles.headerSubtitle}>Do you have any existing conditions?</Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.grid}>
                    {conditions.map(c => (
                        <TouchableOpacity
                            key={c}
                            style={[
                                styles.item, 
                                GlobalStyles.glass,
                                selected.includes(c) && { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary }
                            ]}
                            onPress={() => toggle(c)}
                        >
                            <Text style={[styles.itemText, { color: '#fff' }, selected.includes(c) && { fontWeight: 'bold' }]}>{c}</Text>
                            {selected.includes(c) && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: Theme.colors.primary }]}
                    onPress={() => navigation.navigate('CurrentMedications', { ...route.params, conditions: selected })}
                >
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 10 }} />
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 30 },
    item: {
        width: '47%',
        padding: 20,
        borderRadius: 15,
        marginBottom: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    itemText: { fontSize: 14 },
    button: {
        height: 55,
        borderRadius: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
