import React from 'react';
import { View, Text } from 'react-native';

export default function EmergencyScreen() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'red' }}>Emergency Mode</Text>
            <Text style={{ marginTop: 10 }}>Contacting authorities...</Text>
        </View>
    );
}
