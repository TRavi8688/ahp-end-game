import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Platform, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Screens
import HomeScreen from '../screens/HomeScreen';
import RecordsScreen from '../screens/RecordsScreen';
import HealthIdScreen from '../screens/HealthIdScreen';
import AiAssistScreen from '../screens/AiAssistScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const CustomTabBarButton = ({ children, onPress, focused }) => (
  <TouchableOpacity
    style={{
      top: -20,
      justifyContent: 'center',
      alignItems: 'center',
      ...styles.shadow
    }}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <LinearGradient
      colors={['#7c3aed', '#5b21b6']}
      style={{
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
      }}
    >
      <Image 
        source={require('../../assets/chitti_avatar.png')} 
        style={{ 
          width: 55, 
          height: 55, 
          borderRadius: 27.5,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)'
        }} 
      />
    </LinearGradient>
    <Text style={{ 
      color: focused ? '#7c3aed' : '#94a3b8', 
      fontSize: 10, 
      fontWeight: 'bold',
      marginTop: 2 
    }}>Chitti AI</Text>
  </TouchableOpacity>
);

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true, // Enterprise standard
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 15,
          right: 15,
          elevation: 5,
          backgroundColor: 'rgba(255, 255, 255, 0.7)', // More glass-like
          borderRadius: 30,
          height: 65,
          paddingBottom: 10,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.4)', // Frosty border
          ...styles.shadow
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 5,
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
        },
        headerTitleStyle: {
          fontWeight: '900',
          color: '#1e293b',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          title: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          )
        }} 
      />
      <Tab.Screen 
        name="Records" 
        component={RecordsScreen} 
        options={{ 
          title: 'Records',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'folder-open' : 'folder-outline'} size={22} color={color} />
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
          headerTitle: 'Chitti Clinical AI'
        }} 
      />
      <Tab.Screen 
        name="My ID" 
        component={HealthIdScreen} 
        options={{ 
          title: 'Passport',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'qr-code' : 'qr-code-outline'} size={22} color={color} />
          )
        }} 
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ 
          title: 'More',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} size={22} color={color} />
          )
        }} 
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#7F5DF0',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 5
  }
});
