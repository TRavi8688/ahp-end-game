import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme, GlobalStyles } from '../theme/Theme';

export default function SettingsScreen() {
    return (
        <View style={GlobalStyles.screen}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>HOSPYN NETWORK</Text>
                <Text style={styles.headerSub}>Settings</Text>
            </View>
            <View style={styles.content}>
                <Text style={styles.text}>Profile & Settings coming soon.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { padding: 24, paddingTop: 60, paddingBottom: 10 },
    headerTitle: { fontSize: 12, color: Theme.colors.secondary, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
    headerSub: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
    content: { padding: 24 },
    text: { color: Theme.colors.textMuted }
});
