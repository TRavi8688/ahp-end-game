import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from './src/theme/Theme';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import PrescriptionsScreen from './src/screens/PrescriptionsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: Theme.colors.surface,
                    borderTopColor: Theme.colors.border,
                    paddingBottom: 5,
                    paddingTop: 5,
                },
                tabBarActiveTintColor: Theme.colors.primary,
                tabBarInactiveTintColor: Theme.colors.textMuted,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'Dashboard') {
                        iconName = focused ? 'apps' : 'apps-outline';
                    } else if (route.name === 'Inventory') {
                        iconName = focused ? 'medkit' : 'medkit-outline';
                    } else if (route.name === 'Prescriptions') {
                        iconName = focused ? 'document-text' : 'document-text-outline';
                    } else if (route.name === 'More') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Prescriptions" component={PrescriptionsScreen} />
            <Tab.Screen name="Inventory" component={InventoryScreen} />
            <Tab.Screen name="More" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

export default function App() {
    // For simplicity, we manage auth state here. In a real app, use Context.
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!isLoggedIn ? (
                    <Stack.Screen name="Login">
                        {(props) => <LoginScreen {...props} onLogin={() => setIsLoggedIn(true)} />}
                    </Stack.Screen>
                ) : (
                    <Stack.Screen name="MainTabs" component={MainTabs} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
