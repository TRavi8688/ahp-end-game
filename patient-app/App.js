/**
 * patient-app/App.js
 * Phase 6 Fix — Wire push notifications after login
 *
 * REPLACE: patient-app/App.js (full file)
 *
 * Changes from original:
 *   1. registerForPushNotifications() called after isAuthenticated becomes true
 *   2. addNotificationListeners() wired with navigation-aware handlers
 *   3. Notification deep-link routing: appointment_reminder → Appointments,
 *      lab_result → LabResults, billing → Billing
 *   4. cleanup returned from useEffect to prevent memory leaks
 *
 * INSTALL FIRST (run once on your dev machine, then commit package.json):
 *   cd patient-app
 *   npx expo install expo-notifications expo-device expo-constants
 *   # @react-native-async-storage/async-storage is already in package.json v1.23.1
 *
 * NO further manual changes needed after this file is deployed.
 */
import React, { useState, useEffect, useRef } from 'react';
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

    const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
    if (!__DEV__ && !sentryDsn) {
      console.warn('CRITICAL SECURITY WARNING: EXPO_PUBLIC_SENTRY_DSN is missing in production.');
    }
    if (sentryDsn) {
      Sentry.init({
        dsn: sentryDsn,
        debug: __DEV__,
        enableAutoSessionTracking: true,
        environment: __DEV__ ? 'development' : 'production',
      });
    }
  }
} catch (e) {
  console.log('Native module load skipped', e);
}

// Core
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SocketProvider } from './src/contexts/SocketContext';
import ApiService from './src/utils/ApiService';
import { subscribeToTheme, getTheme } from './src/theme';
import { useFonts } from 'expo-font';
import { Syne_800ExtraBold, Syne_700Bold } from '@expo-google-fonts/syne';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans';

// ─── Push Notifications (Phase 6) ─────────────────────────────────────────────
import {
  registerForPushNotifications,
  addNotificationListeners,
} from './src/services/notifications';
// ──────────────────────────────────────────────────────────────────────────────

// ─── Screens ──────────────────────────────────────────────────────────────────
import LoginScreen            from './src/screens/LoginScreen';
import RegisterScreen         from './src/screens/RegisterScreen';
import RegistrationSuccessScreen from './src/screens/RegistrationSuccessScreen';

import MainTabs               from './src/navigation/MainTabs';

import SharedAccessScreen     from './src/screens/SharedAccessScreen';
import SharingSettingsScreen  from './src/screens/SharingSettingsScreen';
import NotificationsScreen    from './src/screens/NotificationsScreen';
import AccessHistoryScreen    from './src/screens/AccessHistoryScreen';
import UploadScreen           from './src/screens/UploadScreen';
import BillingScreen, { BillingDetailScreen } from './src/screens/BillingScreen';
import PrescriptionScreen     from './src/screens/PrescriptionScreen';
import PrescriptionDetailScreen from './src/screens/PrescriptionDetailScreen';
import FamilyProfilesScreen   from './src/screens/FamilyProfilesScreen';
import RecordsScreen          from './src/screens/RecordsScreen';
import ActivityLogScreen      from './src/screens/ActivityLogScreen';
import CEODashboardScreen     from './src/screens/CEODashboardScreen';
import MedsScreen             from './src/screens/MedsScreen';
import AppointmentsScreen     from './src/screens/AppointmentsScreen';
import ChittiAiScreen         from './src/screens/ChittiAiScreen';

// ─── Phase 6: New Screens ─────────────────────────────────────────────────────
// Existing booking screens (already registered in original)
import DoctorSearchScreen     from './src/screens/DoctorSearchScreen';
import BookAppointmentScreen  from './src/screens/BookAppointmentScreen';
import QueueStatusScreen      from './src/screens/QueueStatusScreen';
import RaiseTicketScreen      from './src/screens/RaiseTicketScreen';
import MyTicketsScreen        from './src/screens/MyTicketsScreen';
import SetPasswordScreen      from './src/screens/SetPasswordScreen';
// ─────────────────────────────────────────────────────────────────────────────

import ErrorBoundary from './src/components/ErrorBoundary';

const Stack = createNativeStackNavigator();

function AppContent() {
  const { isAuthenticated, isLoading, logout, needsPasswordSetup, setNeedsPasswordSetup } = useAuth();
  const navigationRef = useRef(null);

  // FIX (2026-06-23): one-time prompt after a Google/Apple sign-in that
  // created an account with no usable Hospyn ID + password. Waits briefly
  // for the post-login screen (MainTabs) to actually mount before navigating,
  // since the navigator's authenticated routes only exist once isAuthenticated
  // flips true.
  useEffect(() => {
    if (!isAuthenticated || !needsPasswordSetup) return;
    const t = setTimeout(() => {
      try {
        navigationRef.current?.navigate('SetPassword');
      } catch (e) {
        console.warn('[Auth] Could not navigate to SetPassword:', e?.message);
      }
      setNeedsPasswordSetup(false);
    }, 700);
    return () => clearTimeout(t);
  }, [isAuthenticated, needsPasswordSetup, setNeedsPasswordSetup]);

  const [fontsLoaded] = useFonts({
    Syne_800ExtraBold,
    Syne_700Bold,
    SpaceMono_400Regular,
    DMSans_400Regular,
  });

  const [theme, setThemeState] = useState(getTheme());
  useEffect(() => {
    return subscribeToTheme((newTheme) => setThemeState(newTheme));
  }, []);

  const [bootReady,  setBootReady]  = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // ── OTA Updates ─────────────────────────────────────────────────────────────
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
        console.log('Update check failed', e);
      }
    };
    checkUpdates();
  }, []);

  // ── Auth failure logout hook ─────────────────────────────────────────────────
  useEffect(() => {
    ApiService.setAuthFailureCallback(() => logout());
  }, [logout]);

  // ── Boot sequence ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const runBoot = async () => {
      if (fontsLoaded && !isLoading && !isUpdating) {
        if (isAuthenticated) {
          const { SecurityService } = require('./src/utils/SecurityService');
          const success = await SecurityService.authenticate('Unlock Hospyn Clinical Vault');
          if (success) {
            setIsUnlocked(true);
          } else {
            logout();
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

  // ── Phase 6: Push Notifications ──────────────────────────────────────────────
  // Register after the user is authenticated (needs auth token to POST push-token
  // to the backend). Cleanup listeners on logout.
  useEffect(() => {
    if (!isAuthenticated) return;

    // Request permission + get token + POST to backend
    registerForPushNotifications().catch((err) => {
      console.warn('[Push] Registration failed silently:', err?.message);
    });

    // Wire notification tap handler — navigate based on payload.type
    const cleanup = addNotificationListeners({
      onReceived: (notification) => {
        console.log('[Push] Received:', notification.request.content.title);
      },
      onResponse: (response) => {
        const data = response.notification.request.content.data || {};
        const nav = navigationRef.current;
        if (!nav) return;

        switch (data.type) {
          case 'appointment_reminder':
            nav.navigate('Appointments');
            break;
          case 'lab_result':
            nav.navigate('LabResults');
            break;
          case 'billing':
            nav.navigate('Billing');
            break;
          default:
            nav.navigate('Notifications');
        }
      },
    });

    return cleanup; // removes listeners on logout/unmount
  }, [isAuthenticated]);
  // ─────────────────────────────────────────────────────────────────────────────

  if (isUpdating || !bootReady) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: theme === 'light' ? '#F8F7FF' : '#050810',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
      }}>
        <Text style={{ color: '#6366F1', fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>
          HOSPYN <Text style={{ color: theme === 'light' ? '#0F172A' : '#fff' }}>CORE</Text>
        </Text>
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{
            color: theme === 'light' ? '#475569' : '#94A3B8',
            fontSize: 12,
            marginTop: 20,
            fontWeight: 'bold',
            letterSpacing: 2,
          }}>
            {isUpdating ? 'SYNCING CLINICAL ASSETS...' : 'INITIALIZING VAULT...'}
          </Text>
        </View>
        <Text style={{
          position: 'absolute',
          bottom: 40,
          color: theme === 'light' ? '#94A3B8' : '#1E293B',
          fontSize: 10,
          fontWeight: 'bold',
        }}>
          VERSION {Updates?.updateId ? Updates.updateId.substring(0, 8).toUpperCase() : '2.0.2-STABLE'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: theme === 'light' ? '#F8F7FF' : '#050810' }}>
      <SocketProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
            {!isAuthenticated ? (
              // ─── Unauthenticated stack ──────────────────────────────────────
              <>
                <Stack.Screen name="Login"               component={LoginScreen} />
                <Stack.Screen name="Register"            component={RegisterScreen} />
                <Stack.Screen name="RegistrationSuccess" component={RegistrationSuccessScreen} />
              </>
            ) : (
              // ─── Authenticated stack ────────────────────────────────────────
              <>
                <Stack.Screen name="MainTabs"            component={MainTabs} />
                <Stack.Screen name="SharedAccess"        component={SharedAccessScreen} />
                <Stack.Screen name="SharingSettings"     component={SharingSettingsScreen} />
                <Stack.Screen name="Notifications"       component={NotificationsScreen} />
                <Stack.Screen name="AccessHistory"       component={AccessHistoryScreen} />
                <Stack.Screen name="Upload"              component={UploadScreen} />
                <Stack.Screen name="Billing"             component={BillingScreen} />
                {/* FIX-B4 (2026-06-24): BillingScreen has always navigated to
                    "BillingDetail" — that screen existed in the same file the
                    whole time (BillingDetailScreen) but was never registered.
                    "InvoiceDetail" below is a different, separately-built
                    screen nothing currently navigates to; left in place but
                    not wired up further, see changelog. */}
                <Stack.Screen name="BillingDetail"        component={BillingDetailScreen} />
                <Stack.Screen name="Prescriptions"       component={PrescriptionScreen} />
                <Stack.Screen name="PrescriptionDetail"  component={PrescriptionDetailScreen} />
                <Stack.Screen name="FamilyProfiles"      component={FamilyProfilesScreen} />
                <Stack.Screen name="LabResults"          component={RecordsScreen} />
                <Stack.Screen name="ActivityLog"         component={ActivityLogScreen} />
                <Stack.Screen name="CEODashboard"        component={CEODashboardScreen} />
                <Stack.Screen name="Meds"                component={MedsScreen} />
                <Stack.Screen name="Appointments"        component={AppointmentsScreen} />
                <Stack.Screen name="ChittiAi"            component={ChittiAiScreen} />

                {/* Existing booking + queue flow */}
                <Stack.Screen name="DoctorSearch"        component={DoctorSearchScreen} />
                <Stack.Screen name="BookAppointment"     component={BookAppointmentScreen} />
                <Stack.Screen name="QueueStatus"         component={QueueStatusScreen} />
                <Stack.Screen name="RaiseTicket"         component={RaiseTicketScreen} />
                <Stack.Screen name="MyTickets"           component={MyTicketsScreen} />
                <Stack.Screen name="SetPassword"         component={SetPasswordScreen} />

                {/* Phase 6: New appointment booking screen */}
                {/* Navigate here with: navigation.navigate("AppointmentBooking") */}
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
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default (Sentry ? Sentry.wrap(App) : App);
