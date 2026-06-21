import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import { Theme, GlobalStyles } from '../theme';
import HapticUtils from '../utils/HapticUtils';

const { width } = Dimensions.get('window');

export default function ProfileSetupScreen({ navigation, route }) {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dob: '', // YYYY-MM-DD
        gender: '', // Male, Female, Other
        bloodGroup: '' // O+, A+, etc
    });

    const validateForm = () => {
        const { firstName, lastName, dob, gender, bloodGroup } = formData;
        if (!firstName || !lastName || !dob || !gender) {
            Alert.alert('Incomplete Profile', 'Clinical sovereignty requires full identity details.');
            return false;
        }
        
        const dobRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        if (!dobRegex.test(dob)) {
            Alert.alert('Invalid Format', 'Date of Birth must be YYYY-MM-DD (e.g. 1995-05-24)');
            return false;
        }

        const genderRegex = /^(Male|Female|Other)$/;
        if (!genderRegex.test(gender)) {
            Alert.alert('Invalid Entry', 'Gender must be Male, Female, or Other');
            return false;
        }

        return true;
    };

    const handleNext = () => {
        HapticUtils.medium();
        if (validateForm()) {
            navigation.navigate('MedicalHistory', { 
                phone: route.params?.phone, 
                ...formData,
                date_of_birth: formData.dob, // Mapping for backend
                first_name: formData.firstName,
                last_name: formData.lastName
            });
        } else {
            HapticUtils.error();
        }
    };

    return (
        <View style={GlobalStyles.screen}>
            <LinearGradient colors={['#050810', '#0F172A']} style={styles.header}>
                <Animated.View entering={FadeInUp}>
                    <Text style={styles.headerTitle}>IDENTITY PROVISIONING</Text>
                    <Text style={styles.headerSub}>Building your Sovereign Health Profile</Text>
                </Animated.View>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInRight.delay(100)} style={styles.inputSection}>
                    <Text style={styles.label}>LEGAL NAMES</Text>
                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, GlobalStyles.glass, { flex: 1, marginRight: 10 }]}
                            placeholder="First Name"
                            placeholderTextColor="#475569"
                            value={formData.firstName}
                            onChangeText={(v) => setFormData({ ...formData, firstName: v })}
                        />
                        <TextInput
                            style={[styles.input, GlobalStyles.glass, { flex: 1 }]}
                            placeholder="Last Name"
                            placeholderTextColor="#475569"
                            value={formData.lastName}
                            onChangeText={(v) => setFormData({ ...formData, lastName: v })}
                        />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInRight.delay(200)} style={styles.inputSection}>
                    <Text style={styles.label}>DATE OF BIRTH (YYYY-MM-DD)</Text>
                    <TextInput
                        style={[styles.input, GlobalStyles.glass]}
                        placeholder="e.g. 1990-08-15"
                        placeholderTextColor="#475569"
                        keyboardType="number-pad"
                        maxLength={10}
                        value={formData.dob}
                        onChangeText={(v) => {
                            // Simple auto-formatter for YYYY-MM-DD
                            let cleaned = v.replace(/\D/g, '');
                            if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);
                            let formatted = cleaned;
                            if (cleaned.length > 4) formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
                            if (cleaned.length > 6) formatted = formatted.slice(0, 7) + '-' + formatted.slice(7);
                            setFormData({ ...formData, dob: formatted });
                        }}
                    />
                </Animated.View>

                <Animated.View entering={FadeInRight.delay(300)} style={styles.inputSection}>
                    <Text style={styles.label}>GENDER (Male / Female / Other)</Text>
                    <TextInput
                        style={[styles.input, GlobalStyles.glass]}
                        placeholder="e.g. Male"
                        placeholderTextColor="#475569"
                        value={formData.gender}
                        onChangeText={(v) => setFormData({ ...formData, gender: v })}
                    />
                </Animated.View>

                <Animated.View entering={FadeInRight.delay(400)} style={styles.inputSection}>
                    <Text style={styles.label}>BLOOD GROUP (Optional)</Text>
                    <TextInput
                        style={[styles.input, GlobalStyles.glass]}
                        placeholder="e.g. O+ or AB-"
                        placeholderTextColor="#475569"
                        maxLength={3}
                        value={formData.bloodGroup}
                        onChangeText={(v) => setFormData({ ...formData, bloodGroup: v.toUpperCase() })}
                    />
                </Animated.View>

                <TouchableOpacity style={styles.button} onPress={handleNext}>
                    <LinearGradient 
                        colors={[Theme.colors.primary, Theme.colors.secondary]} 
                        start={{x:0, y:0}} 
                        end={{x:1, y:0}} 
                        style={styles.gradientBtn}
                    >
                        <Text style={styles.buttonText}>ESTABLISH IDENTITY</Text>
                        <Ionicons name="shield-checkmark" size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>

                <View style={[styles.infoBox, GlobalStyles.glass]}>
                    <Ionicons name="information-circle" size={20} color={Theme.colors.primary} />
                    <Text style={styles.infoText}>
                        This data is used to generate your unique Hospyn ID and verify your clinical records.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, paddingBottom: 32 },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
    headerSub: { color: '#64748B', fontSize: 12, marginTop: 4, fontWeight: 'bold' },
    form: { padding: 24 },
    inputSection: { marginBottom: 24 },
    label: { fontSize: 11, color: Theme.colors.primary, fontWeight: '900', marginBottom: 12, letterSpacing: 1 },
    input: { height: 60, borderRadius: 16, paddingHorizontal: 20, fontSize: 16, color: '#fff' },
    row: { flexDirection: 'row' },
    button: { marginTop: 20, borderRadius: 20, overflow: 'hidden' },
    gradientBtn: { height: 65, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    infoBox: { flexDirection: 'row', padding: 20, borderRadius: 24, marginTop: 40, gap: 12, alignItems: 'center' },
    infoText: { flex: 1, color: '#64748B', fontSize: 11, lineHeight: 16 }
});

