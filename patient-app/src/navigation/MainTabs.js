import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Screens
import HomeScreen from '../screens/HomeScreen';
import RecordsScreen from '../screens/RecordsScreen';
import HealthIdScreen from '../screens/HealthIdScreen';
import AiAssistScreen from '../screens/AiAssistScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Vault') {
            iconName = focused ? 'folder-open' : 'folder-outline';
          } else if (route.name === 'Health ID') {
            iconName = focused ? 'qr-code' : 'qr-code-outline';
          } else if (route.name === 'Chitti AI') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'More') {
            iconName = focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f1f5f9',
          height: 65,
          paddingBottom: 10,
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
        headerTintColor: '#1e293b',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Vault" component={RecordsScreen} options={{ title: 'Records' }} />
      <Tab.Screen name="Health ID" component={HealthIdScreen} options={{ title: 'Passport' }} />
      <Tab.Screen name="Chitti AI" component={AiAssistScreen} options={{ title: 'Chitti AI' }} />
      <Tab.Screen name="More" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}
