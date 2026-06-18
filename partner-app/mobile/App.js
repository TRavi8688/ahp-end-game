// ============================================================
// App.js — Root entry with navigation + auth check
// Place at: pharma-mobile-app/App.js (replace existing)
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getToken, setNavigationRef } from './src/services/pharmaApi';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import PrescriptionsScreen from './src/screens/PrescriptionsScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null); // null = loading
  const navigationRef = useRef(null);

  useEffect(() => {
    getToken()
      .then(token => setInitialRoute(token ? 'Dashboard' : 'Login'))
      .catch(() => setInitialRoute('Login'));
  }, []);

  if (!initialRoute) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={(ref) => {
        navigationRef.current = ref;
        setNavigationRef(ref);
      }}
    >
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: '#0ea5e9' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Hospyn Pharma', headerLeft: null }} />
        <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Medicine Inventory' }} />
        <Stack.Screen name="Prescriptions" component={PrescriptionsScreen} options={{ title: 'Pending Prescriptions' }} />
        <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{ title: 'Scan Medicine' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f9ff' },
});


// ============================================================
// PACKAGES TO INSTALL:
// ============================================================
// npx expo install expo-secure-store expo-barcode-scanner
// npm install @react-navigation/native @react-navigation/native-stack
// npx expo install react-native-screens react-native-safe-area-context
//
// Or add to package.json dependencies:
// "expo-secure-store": "*",
// "expo-barcode-scanner": "*",
// "@react-navigation/native": "^6.0.0",
// "@react-navigation/native-stack": "^6.0.0",
// "react-native-screens": "*",
// "react-native-safe-area-context": "*"
// ============================================================
