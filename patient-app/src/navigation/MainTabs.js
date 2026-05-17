import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Platform, Text, Keyboard } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Screens
import HomeScreen from '../screens/HomeScreen';
import RecordsScreen from '../screens/RecordsScreen';
import ShareDoctorScreen from '../screens/ShareDoctorScreen';
import AiAssistScreen from '../screens/AiAssistScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Theme, GlobalStyles } from '../theme';

const Tab = createBottomTabNavigator();

const CustomTabBarButton = ({ children, onPress, focused }) => (
  <TouchableOpacity
    style={{
      top: -30,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100
    }}
    onPress={onPress}
    activeOpacity={0.9}
  >
    <View style={styles.aiButtonOuter}>
        <LinearGradient
        colors={[Theme.colors.primary, '#4338CA']}
        style={styles.aiButtonInner}
        >
        <Image 
            source={require('../../assets/chitti_avatar.png')} 
            style={styles.aiAvatar} 
        />
        </LinearGradient>
    </View>
    <Text style={[styles.aiLabel, { color: focused ? Theme.colors.primary : '#64748B' }]}>CHITTI AI</Text>
  </TouchableOpacity>
);

export default function MainTabs() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web fallback: Check focus/blur on input controls globally
      const handleFocusIn = (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable') === 'true')) {
          setKeyboardVisible(true);
        }
      };
      const handleFocusOut = (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable') === 'true')) {
          // Add small delay to avoid flicker during quick focus switches
          setTimeout(() => {
            const active = document.activeElement;
            if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && active.getAttribute('contenteditable') !== 'true')) {
              setKeyboardVisible(false);
            }
          }, 100);
        }
      };
      
      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);
      
      return () => {
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
      };
    } else {
      // Native keyboard listeners
      const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
      const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
      
      return () => {
        showSubscription.remove();
        hideSubscription.remove();
      };
    }
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: '#475569',
        tabBarStyle: {
          display: route.name === 'Chitti AI' || keyboardVisible ? 'none' : 'flex',
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          backgroundColor: 'rgba(15, 23, 42, 0.8)', // Translucent Deep Navy
          borderRadius: 30,
          height: 75,
          paddingBottom: 15,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
          marginBottom: 0,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          title: 'COMMAND',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={20} color={color} />
          )
        }} 
      />
      <Tab.Screen 
        name="Records" 
        component={RecordsScreen} 
        options={{ 
          title: 'VAULT',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'folder' : 'folder-outline'} size={20} color={color} />
          )
        }} 
      />
      <Tab.Screen 
        name="Chitti AI" 
        component={AiAssistScreen} 
        options={{ 
          tabBarStyle: { display: 'none' }, // Immersive full-screen clinical chat companion
          tabBarButton: (props) => (
            <CustomTabBarButton {...props} focused={props?.accessibilityState?.selected} />
          ),
        }} 
      />
      <Tab.Screen 
        name="My ID" 
        component={ShareDoctorScreen} 
        options={{ 
          title: 'CONNECT',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'qr-code' : 'qr-code-outline'} size={20} color={color} />
          )
        }} 
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ 
          title: 'MORE',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} size={20} color={color} />
          )
        }} 
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20
  },
  aiButtonOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#050810',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  aiButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  aiAvatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  aiLabel: { 
    fontSize: 9, 
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 1
  }
});
