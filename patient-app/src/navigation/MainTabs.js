import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Platform, Text } from 'react-native';
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: '#475569',
        tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          backgroundColor: '#0F172A', // Deep Navy/Black
          borderRadius: 24,
          height: 70,
          paddingBottom: 12,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.05)',
          ...styles.shadow
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '900',
          marginBottom: 0,
          letterSpacing: 1,
        },
        headerShown: false, // Handle headers in screens for luxury feel
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
