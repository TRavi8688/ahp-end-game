import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, GlobalStyles } from '../theme';

const { width } = Dimensions.get('window');

export default function VitalsScreen({ navigation }) {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

    const VitalBlock = ({ label, value, unit, sub, status, statusColor, children }) => (
        <View style={styles.vitalBlock}>
            <Text style={styles.vitalLabel}>{label}</Text>
            <View style={styles.valueRow}>
                <Text style={styles.vitalValue}>{value}</Text>
                <Text style={styles.vitalUnit}>{unit}</Text>
            </View>
            <Text style={styles.vitalSub}>{sub}</Text>
            {children}
            <Text style={[styles.vitalStatus, { color: Theme.colors[statusColor] || statusColor }]}>{status}</Text>
        </View>
    );

    return (
        <View style={GlobalStyles.screen}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.topBarLabel}>VITALS</Text>
                </View>
                <Text style={styles.topBarDate}>{today}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.bigHeading}>YOUR BODY.</Text>
                <Text style={styles.updateText}>LAST UPDATED 08:42 AM</Text>

                <View style={styles.divider} />

                {/* Block 1 — Blood Pressure */}
                <TouchableOpacity onPress={() => navigation.navigate('WeeklyTrends')}>
                    <VitalBlock
                        label="BLOOD PRESSURE"
                        value="128 / 84"
                        unit="mmHg"
                        sub="SYSTOLIC / DIASTOLIC"
                        status="↑ STAGE 1 HYPERTENSION"
                        statusColor="warning"
                    >
                        {/* 7-bar mini chart */}
                        <View style={styles.miniChart}>
                            {[40, 50, 45, 60, 55, 75, 80].map((h, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.chartBar,
                                        { height: h },
                                        i >= 5 && { backgroundColor: Theme.colors.warning }
                                    ]}
                                />
                            ))}
                        </View>
                    </VitalBlock>
                </TouchableOpacity>

                {/* Block 2 — Heart Rate */}
                <VitalBlock
                    label="HEART RATE"
                    value="76"
                    unit="bpm"
                    status="✓ NORMAL RANGE"
                    statusColor="positive"
                >
                    {/* Flat line waveform graphic */}
                    <View style={styles.waveformContainer}>
                        <View style={styles.waveformLine} />
                        <View style={styles.waveformPeak} />
                        <View style={styles.waveformLine} />
                    </View>
                </VitalBlock>

                {/* Block 3 — Blood Oxygen */}
                <VitalBlock
                    label="BLOOD OXYGEN"
                    value="96%"
                    unit="SpO₂"
                    status="✓ NORMAL"
                    statusColor="positive"
                >
                    {/* Horizontal fill bar */}
                    <View style={styles.fillBarContainer}>
                        <View style={[styles.fillBar, { width: '96%' }]} />
                    </View>
                </VitalBlock>

                {/* Block 4 — Temperature */}
                <VitalBlock
                    label="TEMPERATURE"
                    value="98.4°F"
                    unit=""
                    status="✓ NORMAL"
                    statusColor="positive"
                />

                <TouchableOpacity style={styles.shareButton}>
                    <Text style={styles.shareButtonText}>SHARE REPORT WITH DR. SHARMA →</Text>
                </TouchableOpacity>

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    topBarLabel: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 12,
        letterSpacing: 2,
    },
    topBarDate: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.primary,
        fontSize: 10,
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
    updateText: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 10,
        marginTop: 5,
    },
    divider: {
        height: 1,
        backgroundColor: '#FFFFFF',
        width: '100%',
        marginVertical: 20,
    },
    vitalBlock: {
        paddingVertical: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    vitalLabel: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 10,
        letterSpacing: 2,
        marginBottom: 10,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    vitalValue: {
        fontFamily: Theme.fonts.heading,
        color: Theme.colors.primary,
        fontSize: 36,
    },
    vitalUnit: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 14,
        paddingBottom: 5,
    },
    vitalSub: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 10,
        marginTop: 5,
    },
    vitalStatus: {
        fontFamily: Theme.fonts.label,
        fontSize: 11,
        marginTop: 15,
        letterSpacing: 1,
    },
    miniChart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        height: 80,
        marginTop: 20,
    },
    chartBar: {
        width: 12,
        backgroundColor: '#FFFFFF',
    },
    waveformContainer: {
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
    },
    waveformLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#FFFFFF',
    },
    waveformPeak: {
        width: 30,
        height: 30,
        borderWidth: 1,
        borderTopWidth: 2,
        borderColor: '#FFFFFF',
        borderBottomWidth: 0,
        marginHorizontal: 10,
    },
    fillBarContainer: {
        height: 8,
        backgroundColor: '#1A1A1A',
        width: '100%',
        marginTop: 20,
    },
    fillBar: {
        height: '100%',
        backgroundColor: '#FFFFFF',
    },
    shareButton: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 20,
        alignItems: 'center',
        marginTop: 40,
    },
    shareButtonText: {
        fontFamily: Theme.fonts.headingSemi,
        color: '#000000',
        fontSize: 14,
        letterSpacing: 1,
    }
});
