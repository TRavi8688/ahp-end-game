import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, GlobalStyles } from '../theme';

const { width } = Dimensions.get('window');

export default function AppointmentsScreen({ navigation }) {
    const upcoming = [
        { doctor: 'DR. ANJALI SHARMA', specialty: 'CARDIOLOGY', time: '10:30 AM', date: 'TOMORROW' },
    ];

    const past = [
        { doctor: 'DR. VIKRAM MEHTA', specialty: 'GENERAL PHYSICIAN', time: '04:00 PM', date: '02 MAR 2024' },
    ];

    return (
        <View style={GlobalStyles.screen}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.topBarLabel}>APPOINTMENTS</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.bigHeading}>DR. CONNECT.</Text>
                <View style={styles.divider} />

                {/* Upcoming */}
                <Text style={styles.sectionLabel}>UPCOMING</Text>
                {upcoming.map((apt, i) => (
                    <View key={i} style={styles.aptCard}>
                        <Text style={styles.docName}>{apt.doctor}</Text>
                        <Text style={styles.aptMeta}>{apt.specialty} · {apt.time} · {apt.date}</Text>
                        <TouchableOpacity style={styles.videoButton}>
                            <Text style={styles.videoButtonText}>JOIN VIDEO CALL</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                {/* Past */}
                <Text style={[styles.sectionLabel, { marginTop: 40 }]}>PAST CONSULTATIONS</Text>
                {past.map((apt, i) => (
                    <View key={i} style={styles.pastCard}>
                        <Text style={styles.pastDocName}>{apt.doctor}</Text>
                        <Text style={styles.pastMeta}>{apt.specialty} · {apt.date}</Text>
                    </View>
                ))}

                <View style={{ height: 50 }} />
            </ScrollView>
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
    divider: {
        height: 1,
        backgroundColor: '#FFFFFF',
        width: '100%',
        marginVertical: 20,
    },
    sectionLabel: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 10,
        letterSpacing: 1,
        marginBottom: 15,
    },
    aptCard: {
        borderWidth: 1,
        borderColor: '#FFFFFF',
        padding: 20,
        marginBottom: 20,
    },
    docName: {
        fontFamily: Theme.fonts.headingSemi,
        color: Theme.colors.primary,
        fontSize: 18,
    },
    aptMeta: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 10,
        marginTop: 5,
        letterSpacing: 0.5,
    },
    videoButton: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 20,
    },
    videoButtonText: {
        fontFamily: Theme.fonts.headingSemi,
        color: '#000000',
        fontSize: 12,
        letterSpacing: 1,
    },
    pastCard: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#333333',
        padding: 20,
        marginBottom: 15,
    },
    pastDocName: {
        fontFamily: Theme.fonts.headingSemi,
        color: '#555555',
        fontSize: 16,
    },
    pastMeta: {
        fontFamily: Theme.fonts.label,
        color: '#333333',
        fontSize: 9,
        marginTop: 5,
    }
});
