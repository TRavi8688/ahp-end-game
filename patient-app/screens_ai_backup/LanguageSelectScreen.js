import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Theme, GlobalStyles } from '../theme';

const { width } = Dimensions.get('window');

export default function OnboardingScreen({ navigation }) {
    return (
        <View style={GlobalStyles.screen}>
            {/* Top Left Indicator */}
            <View style={styles.header}>
                <Text style={styles.stepIndicator}>01 / 03</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.bigHeading}>WHO ARE YOU?</Text>

                {/* Thin gray line divider */}
                <View style={styles.divider} />

                <View style={styles.optionsContainer}>
                    {/* PATIENT OPTION */}
                    <TouchableOpacity
                        style={[styles.box, styles.patientBox]}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <Text style={styles.patientText}>PATIENT</Text>
                    </TouchableOpacity>

                    {/* DOCTOR OPTION */}
                    <TouchableOpacity
                        style={[styles.box, styles.doctorBox]}
                        disabled={true} // Doctor app is separate, but we show it dimmed as per spec
                    >
                        <Text style={styles.doctorText}>DOCTOR</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Link */}
            <TouchableOpacity
                style={styles.bottomLink}
                onPress={() => navigation.navigate('Login')}
            >
                <Text style={styles.bottomLinkText}>ALREADY HAVE AN ACCOUNT? SIGN IN →</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: 60,
        paddingLeft: 30,
    },
    stepIndicator: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 14,
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        justifyContent: 'center',
    },
    bigHeading: {
        fontFamily: Theme.fonts.heading,
        color: Theme.colors.primary,
        fontSize: 40,
        lineHeight: 48,
        width: '80%',
    },
    divider: {
        height: 1,
        backgroundColor: '#1A1A1A',
        width: '100%',
        marginVertical: 30,
    },
    optionsContainer: {
        gap: 20,
    },
    box: {
        width: '100%',
        paddingVertical: 25,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    patientBox: {
        borderColor: Theme.colors.primary,
    },
    doctorBox: {
        borderColor: '#333333', // Dimmed gray border
    },
    patientText: {
        fontFamily: Theme.fonts.headingSemi,
        color: Theme.colors.primary,
        fontSize: 20,
        letterSpacing: 2,
    },
    doctorText: {
        fontFamily: Theme.fonts.headingSemi,
        color: '#555555', // Dimmed text
        fontSize: 20,
        letterSpacing: 2,
    },
    bottomLink: {
        paddingBottom: 50,
        alignItems: 'center',
    },
    bottomLinkText: {
        fontFamily: Theme.fonts.label,
        color: Theme.colors.secondary,
        fontSize: 10,
        letterSpacing: 1,
    }
});
