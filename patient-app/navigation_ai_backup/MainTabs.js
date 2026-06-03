import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';

// Import Screens
import HomeScreen from '../screens/HomeScreen';
import MyRecordsScreen from '../screens/MyRecordsScreen';
import ChittiAiScreen from '../screens/ChittiAiScreen';
import SettingsScreen from '../screens/SettingsScreen';

import * as Haptics from 'expo-haptics';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarButton: (props) => (
                    <TouchableOpacity
                        {...props}
                        onPress={(e) => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            props.onPress(e);
                        }}
                    />
                ),
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Records') {
                        iconName = focused ? 'medical' : 'medical-outline';
                    } else if (route.name === 'Chitti') {
                        iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
                    } else if (route.name === 'Settings') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#6366F1',
                tabBarInactiveTintColor: '#94A3B8',
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(255, 255, 255, 0.05)',
                    backgroundColor: '#050810',
                    elevation: 0,
                    height: 60,
                    paddingBottom: 5,
                },
                headerStyle: {
                    backgroundColor: '#050810',
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
                },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Unified Profile' }} />
            <Tab.Screen name="Records" component={MyRecordsScreen} options={{ title: 'My Records' }} />
            <Tab.Screen name="Chitti" component={ChittiAiScreen} options={{ title: 'Chitti AI' }} />
            <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Tab.Navigator>
    );
}
