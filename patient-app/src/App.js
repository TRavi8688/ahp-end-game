/**
 * App.js — Hospyn Patient App Root
 *
 * FIX 1: Removed navigation.replace('Home') calls from LoginScreen —
 *         Auth state drives navigation entirely via isAuthenticated in AuthContext.
 *         NavigationContainer re-mounts the right navigator automatically.
 *
 * FIX 2: Added SplashScreen during auth initialization instead of blank loading text.
 *
 * FIX 3: Onboarding and Registration screens added to Auth stack so
 *         navigation.navigate('Onboarding') and navigation.navigate('Register')
 *         from LoginScreen do not crash.
 *
 * FIX 4: All main app screens accessible from root stack OR via the tab stacks
 *         defined in MainTabs.js.
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SocketProvider } from './src/contexts/SocketContext';

// Navigators
import MainTabs from './src/navigation/MainTabs';

// Auth Screens
import LoginScreen      from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import RegisterScreen   from './src/screens/RegisterScreen';
import RegistrationSuccessScreen from './src/screens/RegistrationSuccessScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import SplashScreen     from './src/screens/SplashScreen';

// ─── Sentry Init ──────────────────────────────────────────────────────────────
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
  tracesSampleRate: 0.2,
  enableNativeFramesTracking: true,
  attachStacktrace: true,
});

const Stack = createNativeStackNavigator();

// ─── Root Navigator ───────────────────────────────────────────────────────────
function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isAuthenticated ? (
          // ── App Stack ─────────────────────────────────────────────────────
          <Stack.Screen name="AppTabs" component={MainTabs} />
        ) : (
          // ── Auth Stack ────────────────────────────────────────────────────
          <>
            <Stack.Screen name="Auth"                component={LoginScreen} />
            <Stack.Screen name="Onboarding"          component={OnboardingScreen} />
            <Stack.Screen name="Register"            component={RegisterScreen} />
            <Stack.Screen name="RegistrationSuccess" component={RegistrationSuccessScreen} />
            <Stack.Screen name="ProfileSetup"        component={ProfileSetupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorBody}>Our team has been notified. Please restart the app.</Text>
          <TouchableOpacity
            style={styles.restartBtn}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.restartBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <RootNavigator />
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  errorScreen:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 32 },
  errorTitle:   { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  errorBody:    { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  restartBtn:   { marginTop: 24, backgroundColor: '#6366F1', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  restartBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
