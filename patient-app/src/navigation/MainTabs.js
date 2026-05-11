import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

// Import Old App Screens
import HomeScreen from '../screens/HomeScreen';
import RecordsScreen from '../screens/RecordsScreen';
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
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Records') {
            iconName = focused ? 'medical' : 'medical-outline';
          } else if (route.name === 'AI Assist') {
            iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#050810',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
        },
        headerStyle: {
          backgroundColor: '#050810',
        },
        headerTintColor: '#FFFFFF',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Records" component={RecordsScreen} options={{ title: 'Vault' }} />
      <Tab.Screen name="AI Assist" component={AiAssistScreen} options={{ title: 'Hospyn AI' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
}
