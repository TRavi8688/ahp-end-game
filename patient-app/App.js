import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Platform-conditional imports (these crash on web)
let Sentry = null;
let Updates = null;
try {
  if (Platform.OS !== 'web') {
    Sentry = require('@sentry/react-native');
    Updates = require('expo-updates');
    // Initialize Sentry for production monitoring
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "https://placeholder@sentry.io/hospyn-mobile",
      debug: __DEV__,
      enableAutoSessionTracking: true,
    });
  }
} catch (e) {
  console.log("Native module load skipped", e);
}


// Core
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SocketProvider } from './src/contexts/SocketContext';
import ApiService from './src/utils/ApiService';
import { useFonts } from 'expo-font';
import { Syne_800ExtraBold, Syne_700Bold } from '@expo-google-fonts/syne';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import MainTabs from './src/navigation/MainTabs';
import RegistrationSuccessScreen from './src/screens/RegistrationSuccessScreen';
import SharedAccessScreen from './src/screens/SharedAccessScreen';
import SharingSettingsScreen from './src/screens/SharingSettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import AccessHistoryScreen from './src/screens/AccessHistoryScreen';
import UploadScreen from './src/screens/UploadScreen';
import BillingScreen from './src/screens/BillingScreen';
import InvoiceDetailScreen from './src/screens/InvoiceDetailScreen';
import PrescriptionScreen from './src/screens/PrescriptionScreen';
import PrescriptionDetailScreen from './src/screens/PrescriptionDetailScreen';
import FamilyProfilesScreen from './src/screens/FamilyProfilesScreen';
import RecordsScreen from './src/screens/RecordsScreen';
import ActivityLogScreen from './src/screens/ActivityLogScreen';
import CEODashboardScreen from './src/screens/CEODashboardScreen';
import MedsScreen from './src/screens/MedsScreen';

const Stack = createNativeStackNavigator();

function AppContent() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [fontsLoaded] = useFonts({
    Syne_800ExtraBold,
    Syne_700Bold,
    SpaceMono_400Regular,
    DMSans_400Regular,
  });

  const [bootReady, setBootReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const checkUpdates = async () => {
      if (__DEV__ || Platform.OS === 'web' || !Updates) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setIsUpdating(true);
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log("Update check failed", e);
      }
    };
    checkUpdates();
  }, []);

  useEffect(() => {
    ApiService.setAuthFailureCallback(() => {
      logout();
    });
  }, [logout]);

  useEffect(() => {
    const runBoot = async () => {
      if (fontsLoaded && !isLoading && !isUpdating) {
        if (isAuthenticated) {
          const { SecurityService } = require('./src/utils/SecurityService');
          const success = await SecurityService.authenticate('Unlock Hospyn Clinical Vault');
          if (success) {
            setIsUnlocked(true);
          } else {
            logout(); // Kick back to login screen to protect data
          }
          setBootReady(true);
        } else {
          setIsUnlocked(true);
          setBootReady(true);
        }
      }
    };
    runBoot();
  }, [fontsLoaded, isLoading, isAuthenticated, isUpdating]);

  if (isUpdating || !bootReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050810', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Text style={{ color: '#6366F1', fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>HOSPYN <Text style={{color: '#fff'}}>CORE</Text></Text>
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{ color: '#475569', fontSize: 12, marginTop: 20, fontWeight: 'bold', letterSpacing: 2 }}>
            {isUpdating ? "SYNCING CLINICAL ASSETS..." : "INITIALIZING VAULT..."}
          </Text>
        </View>
        <Text style={{ position: 'absolute', bottom: 40, color: '#1E293B', fontSize: 10, fontWeight: 'bold' }}>VERSION {Updates?.updateId ? Updates.updateId.substring(0,8).toUpperCase() : '2.0.2-STABLE'}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#050810' }}>
      <SocketProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
            {!isAuthenticated ? (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="RegistrationSuccess" component={RegistrationSuccessScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen name="SharedAccess" component={SharedAccessScreen} />
                <Stack.Screen name="SharingSettings" component={SharingSettingsScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="AccessHistory" component={AccessHistoryScreen} />
                <Stack.Screen name="Upload" component={UploadScreen} />
                <Stack.Screen name="Billing" component={BillingScreen} />
                <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
                <Stack.Screen name="Prescriptions" component={PrescriptionScreen} />
                <Stack.Screen name="PrescriptionDetail" component={PrescriptionDetailScreen} />
                <Stack.Screen name="FamilyProfiles" component={FamilyProfilesScreen} />
                <Stack.Screen name="LabResults" component={RecordsScreen} />
                <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
                <Stack.Screen name="CEODashboard" component={CEODashboardScreen} />
                <Stack.Screen name="Meds" component={MedsScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SocketProvider>
    </SafeAreaProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// Sentry.wrap is only available on native platforms
export default (Sentry ? Sentry.wrap(App) : App);
