import React from 'react';
import { View, Text, StyleSheet } from 'react-native-web';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050810',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#6366F1',
    fontSize: 24,
    fontWeight: 'bold',
  }
});

export default function AlternativeApp() {
  console.log('[Hospyn] V12 Bypass Diagnostic Mounting...');
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hospyn SYSTEM ONLINE</Text>
      <Text style={{ color: 'white', marginTop: 20 }}>V12 Total Bypass Success</Text>
    </View>
  );
}
