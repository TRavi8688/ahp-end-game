import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlobalStyles } from '../theme';

export default function HealthSummaryScreen() {
    return (
        <View style={[GlobalStyles.screen, styles.center]}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Hospyn Health Summary</Text>
            <Text style={{ color: '#64748B', fontSize: 13, marginTop: 10 }}>Your clinical summary dashboard is compiling.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }
});
