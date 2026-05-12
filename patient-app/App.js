import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecurityUtils } from './src/utils/security';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
import EmergencyModeScreen from './src/screens/EmergencyModeScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ClinicalTimelineScreen from './src/screens/ClinicalTimelineScreen';
import RecordsScreen from './src/screens/RecordsScreen';
import FamilyProfilesScreen from './src/screens/FamilyProfilesScreen';

const Stack = createNativeStackNavigator();

// -----------------------------------------------------------------------------------
// ERROR BOUNDARY FOR RESILIENCE
// -----------------------------------------------------------------------------------
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { 
    console.error('[Fatal App Error]', error, info); 
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#050810', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ color: '#EF4444', fontSize: 24, fontWeight: 'bold' }}>App Error</Text>
          <Text style={{ color: '#94A3B8', marginTop: 20 }}>An unexpected error occurred.</Text>
          <Text style={{ color: '#FCD34D', marginTop: 20, fontFamily: 'monospace', textAlign: 'center' }}>{this.state.error?.toString()}</Text>
          <TouchableOpacity 
            style={{ marginTop: 40, padding: 15, backgroundColor: '#6366F1', borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [fontsLoaded] = useFonts({
    Syne_800ExtraBold,
    Syne_700Bold,
    SpaceMono_400Regular,
    DMSans_400Regular,
  });

  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    // Register global auth failure listener
    ApiService.setAuthFailureCallback(() => {
      console.warn('[App] Automatic logout triggered by API failure');
      logout();
    });
  }, [logout]);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      console.log('[App] Fonts loaded and Auth initialized, system ready');
      setBootReady(true);
    }
  }, [fontsLoaded, isLoading]);

  if (!bootReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050810', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#6366F1', fontSize: 42, letterSpacing: 10, fontWeight: '900' }}>HOSPYN</Text>
        <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
        <Text style={{ color: '#94A3B8', marginTop: 20, letterSpacing: 2 }}>SECURE BOOT INITIALIZING...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#050810' }}>
      <SocketProvider>
        <NavigationContainer>
          <Stack.Navigator 
            screenOptions={{ headerShown: false, animation: 'fade' }} 
          >
            {!isAuthenticated ? (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                <Stack.Screen name="EmergencyMode" component={EmergencyModeScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="Timeline" component={ClinicalTimelineScreen} />
                <Stack.Screen name="Records" component={RecordsScreen} />
                <Stack.Screen name="FamilyProfiles" component={FamilyProfilesScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SocketProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
