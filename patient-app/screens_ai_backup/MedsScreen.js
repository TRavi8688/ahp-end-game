import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, GlobalStyles } from '../theme';

const { width } = Dimensions.get('window');

export default function MedsScreen({ navigation }) {
    const meds = [
        { name: 'ATORVASTATIN', dose: '20MG', time: 'DINNER', status: 'Taken' },
        { name: 'METFORMIN', dose: '500MG', time: 'LUNCH', status: 'Pending' },
        { name: 'AMLODIPINE', dose: '5MG', time: 'MORNING', status: 'Pending' },
    ];

    return (
        <View style={GlobalStyles.screen}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.topBarLabel}>ACTIVE MEDICATIONS</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.bigHeading}>RX PROTOCOL.</Text>

                {/* Protocol Progress */}
                <View style={styles.progressSection}>
                    <Text style={styles.progressLabel}>TODAY'S ADHERENCE — 12%</Text>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: '12%' }]} />
                    </View>
                </View>

                <View style={styles.list}>
                    {meds.map((med, i) => (
                        <View key={i} style={styles.medCard}>
                            <View style={styles.medHeader}>
                                <Text style={styles.medName}>{med.name}</Text>
                                <View style={styles.timeBadge}>
                                    <Text style={styles.timeBadgeText}>{med.time}</Text>
                                </View>
                            </View>
                            <View style={styles.medFooter}>
                                <Text style={styles.medDose}>{med.dose}</Text>
                                <TouchableOpacity style={[styles.statusToggle, med.status === 'Taken' && styles.statusTaken]}>
                                    <Text style={[styles.statusToggleText, med.status === 'Taken' && styles.statusTakenText]}>
                                        {med.status.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Floating Square Button [+] */}
            <TouchableOpacity style={styles.fab}>
                <Ionicons name="add" size={32} color="#000" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        gap: 20,
        paddingBottom: 20,
    },
    topBarLabel: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 12,
        letterSpacing: 2,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    bigHeading: {
        fontFamily: Theme.fonts.heading,
        color: Theme.colors.primary,
        fontSize: 32,
        marginTop: 20,
    },
    progressSection: {
        marginTop: 20,
        marginBottom: 40,
    },
    progressLabel: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 10,
        letterSpacing: 1,
        marginBottom: 10,
    },
    progressTrack: {
        height: 2,
        backgroundColor: '#1A1A1A',
        width: '100%',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FFFFFF',
    },
    list: {
        gap: 20,
    },
    medCard: {
        borderWidth: 1,
        borderColor: '#FFFFFF',
        padding: 20,
    },
    medHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    medName: {
        fontFamily: Theme.fonts.headingSemi,
        color: Theme.colors.primary,
        fontSize: 20,
        flex: 1,
    },
    timeBadge: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    timeBadgeText: {
        fontFamily: Theme.fonts.label,
        color: '#000000',
        fontSize: 10,
    },
    medFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
    },
    medDose: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 14,
    },
    statusToggle: {
        borderWidth: 1,
        borderColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 8,
    },
    statusToggleText: {
        fontFamily: Theme.fonts.label,
        color: '#FFFFFF',
        fontSize: 10,
    },
    statusTaken: {
        backgroundColor: Theme.colors.positive,
        borderColor: Theme.colors.positive,
    },
    statusTakenText: {
        color: '#000000',
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: 30,
        width: 60,
        height: 60,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    }
});
