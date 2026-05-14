import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import RegistrationSuccessScreen from './src/screens/RegistrationSuccessScreen';
import SharedAccessScreen from './src/screens/SharedAccessScreen';
import SharingSettingsScreen from './src/screens/SharingSettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import AccessHistoryScreen from './src/screens/AccessHistoryScreen';
import UploadScreen from './src/screens/UploadScreen';

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

  useEffect(() => {
    ApiService.setAuthFailureCallback(() => {
      logout();
    });
  }, [logout]);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      setBootReady(true);
    }
  }, [fontsLoaded, isLoading]);

  if (!bootReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050810', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#6366F1', fontSize: 42, fontWeight: '900' }}>HOSPYN</Text>
        <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
