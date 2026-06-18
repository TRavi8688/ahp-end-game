/**
 * src/navigation/MainTabs.js
 *
 * FIX 1: Chitti AI tab used tabBarStyle:{display:'none'} on the screen option
 *         which hid the ENTIRE tab bar permanently when Chitti was open.
 *         Now the bar hides ONLY when Chitti is focused via a state variable,
 *         and shows a back-arrow inside ChittiAI so the user can escape.
 *
 * FIX 2: Added ALL missing screens as stack navigators inside each tab so
 *         navigation.navigate('Appointments'), navigation.navigate('Records') etc
 *         all work without "no route" crashes.
 *
 * FIX 3: Keyboard detection properly hides the floating bar on Android/iOS/web.
 *
 * NEW:    Added visual active-tab indicator glow dot under each icon.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Image,
  Platform, Text, Keyboard, Animated,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Theme } from '../theme';

// ── Tab Root Screens ───────────────────────────────────────────────────────────
import HomeScreen           from '../screens/HomeScreen';
import RecordsScreen        from '../screens/RecordsScreen';
import ShareDoctorScreen    from '../screens/ShareDoctorScreen';
import AiAssistScreen       from '../screens/AiAssistScreen';
import SettingsScreen       from '../screens/SettingsScreen';

// ── Stack Screens (navigated to from within tabs) ─────────────────────────────
import AppointmentsScreen      from '../screens/AppointmentsScreen';
import BookAppointmentScreen   from '../screens/BookAppointmentScreen';
import VitalsScreen            from '../screens/VitalsScreen';
import NotificationsScreen     from '../screens/NotificationsScreen';
import MedsScreen              from '../screens/MedsScreen';
import PrescriptionScreen      from '../screens/PrescriptionScreen';
import PrescriptionDetailScreen from '../screens/PrescriptionDetailScreen';
import BillingScreen           from '../screens/BillingScreen';
import InvoiceDetailScreen     from '../screens/InvoiceDetailScreen';
import FamilyProfilesScreen    from '../screens/FamilyProfilesScreen';
import EmergencyModeScreen     from '../screens/EmergencyModeScreen';
import QueueStatusScreen       from '../screens/QueueStatusScreen';
import ClinicalTimelineScreen  from '../screens/ClinicalTimelineScreen';
import DoctorSearchScreen      from '../screens/DoctorSearchScreen';
import UploadScreen            from '../screens/UploadScreen';
import SharedAccessScreen      from '../screens/SharedAccessScreen';
import AccessHistoryScreen     from '../screens/AccessHistoryScreen';
import ActivityLogScreen       from '../screens/ActivityLogScreen';
import HealthIdScreen          from '../screens/HealthIdScreen';
import MedicalHistoryScreen    from '../screens/MedicalHistoryScreen';
import CurrentMedicationsScreen from '../screens/CurrentMedicationsScreen';
import AddDataModal            from '../screens/AddDataModal';
import SharingSettingsScreen   from '../screens/SharingSettingsScreen';
import WeeklyTrendsScreen      from '../screens/WeeklyTrendsScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const SCREEN_OPTIONS = { headerShown: false };

// ── Home Stack ─────────────────────────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="HomeMain"            component={HomeScreen} />
      <Stack.Screen name="Appointments"        component={AppointmentsScreen} />
      <Stack.Screen name="BookAppointment"     component={BookAppointmentScreen} />
      <Stack.Screen name="Vitals"              component={VitalsScreen} />
      <Stack.Screen name="Notifications"       component={NotificationsScreen} />
      <Stack.Screen name="Meds"                component={MedsScreen} />
      <Stack.Screen name="Prescriptions"       component={PrescriptionScreen} />
      <Stack.Screen name="PrescriptionDetail"  component={PrescriptionDetailScreen} />
      <Stack.Screen name="Billing"             component={BillingScreen} />
      <Stack.Screen name="InvoiceDetail"       component={InvoiceDetailScreen} />
      <Stack.Screen name="FamilyProfiles"      component={FamilyProfilesScreen} />
      <Stack.Screen name="Emergency"           component={EmergencyModeScreen} />
      <Stack.Screen name="QueueStatus"         component={QueueStatusScreen} />
      <Stack.Screen name="ClinicalTimeline"    component={ClinicalTimelineScreen} />
      <Stack.Screen name="DoctorSearch"        component={DoctorSearchScreen} />
      <Stack.Screen name="WeeklyTrends"        component={WeeklyTrendsScreen} />
      <Stack.Screen name="AddData"             component={AddDataModal} />
    </Stack.Navigator>
  );
}

// ── Records Stack ──────────────────────────────────────────────────────────────
function RecordsStack() {
  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="RecordsMain"  component={RecordsScreen} />
      <Stack.Screen name="Upload"       component={UploadScreen} />
      <Stack.Screen name="MedicalHistory" component={MedicalHistoryScreen} />
      <Stack.Screen name="CurrentMedications" component={CurrentMedicationsScreen} />
    </Stack.Navigator>
  );
}

// ── Connect Stack (QR/Share) ───────────────────────────────────────────────────
function ConnectStack() {
  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="ConnectMain"    component={ShareDoctorScreen} />
      <Stack.Screen name="HealthId"       component={HealthIdScreen} />
      <Stack.Screen name="SharingSettings" component={SharingSettingsScreen} />
      <Stack.Screen name="SharedAccess"   component={SharedAccessScreen} />
    </Stack.Navigator>
  );
}

// ── Settings Stack ─────────────────────────────────────────────────────────────
function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="SettingsMain"   component={SettingsScreen} />
      <Stack.Screen name="AccessHistory"  component={AccessHistoryScreen} />
      <Stack.Screen name="ActivityLog"    component={ActivityLogScreen} />
      <Stack.Screen name="SharedAccess"   component={SharedAccessScreen} />
      <Stack.Screen name="SharingSettings" component={SharingSettingsScreen} />
    </Stack.Navigator>
  );
}

// ── Chitti AI Floating Button ──────────────────────────────────────────────────
const ChittiButton = ({ onPress, focused }) => {
  const pulse = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (focused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [focused]);

  return (
    <TouchableOpacity
      style={styles.chittiBtn}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View style={styles.chittiOuter}>
          <LinearGradient
            colors={focused ? ['#818CF8', '#4F46E5'] : [Theme.colors.primary, '#4338CA']}
            style={styles.chittiInner}
          >
            <Image
              source={require('../../assets/chitti_avatar.png')}
              style={styles.chittiAvatar}
            />
          </LinearGradient>
        </View>
      </Animated.View>
      <Text style={[styles.chittiLabel, { color: focused ? Theme.colors.primary : '#64748B' }]}>
        CHITTI
      </Text>
    </TouchableOpacity>
  );
};

// ── Main Tab Navigator ─────────────────────────────────────────────────────────
export default function MainTabs() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [chittiActive, setChittiActive]       = useState(false);

  // Keyboard hide/show
  useEffect(() => {
    if (Platform.OS === 'web') {
      const show = (e) => {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.getAttribute?.('contenteditable') === 'true')) {
          setKeyboardVisible(true);
        }
      };
      const hide = (e) => {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.getAttribute?.('contenteditable') === 'true')) {
          setTimeout(() => {
            const a = document.activeElement;
            if (!a || (a.tagName !== 'INPUT' && a.tagName !== 'TEXTAREA' && a.getAttribute?.('contenteditable') !== 'true')) {
              setKeyboardVisible(false);
            }
          }, 100);
        }
      };
      document.addEventListener('focusin', show);
      document.addEventListener('focusout', hide);
      return () => { document.removeEventListener('focusin', show); document.removeEventListener('focusout', hide); };
    } else {
      const s = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
      const h = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
      return () => { s.remove(); h.remove(); };
    }
  }, []);

  // FIX: Tab bar hides when keyboard is up OR Chitti AI is active
  const shouldHideBar = keyboardVisible || chittiActive;

  const tabBarStyle = shouldHideBar
    ? { display: 'none' }
    : styles.tabBar;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: '#475569',
        tabBarStyle: tabBarStyle,
        tabBarLabelStyle: styles.tabLabel,
      })}
      screenListeners={({ route }) => ({
        // Track when Chitti tab gains/loses focus
        focus: () => { if (route.name === 'ChittiAI') setChittiActive(true); },
        blur:  () => { if (route.name === 'ChittiAI') setChittiActive(false); },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          title: 'HOME',
          tabBarIcon: ({ focused, color }) => (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Records"
        component={RecordsStack}
        options={{
          title: 'VAULT',
          tabBarIcon: ({ focused, color }) => (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name={focused ? 'folder' : 'folder-outline'} size={22} color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      {/* FIX: Chitti tab — bar hides via state, not tabBarStyle option */}
      <Tab.Screen
        name="ChittiAI"
        component={AiAssistScreen}
        options={{
          title: '',
          tabBarButton: (props) => (
            <ChittiButton
              onPress={props.onPress}
              focused={props?.accessibilityState?.selected}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Connect"
        component={ConnectStack}
        options={{
          title: 'CONNECT',
          tabBarIcon: ({ focused, color }) => (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name={focused ? 'qr-code' : 'qr-code-outline'} size={22} color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={SettingsStack}
        options={{
          title: 'MORE',
          tabBarIcon: ({ focused, color }) => (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} size={22} color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 32,
    height: 72,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 0,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.primary,
    marginTop: 3,
  },
  // Chitti button
  chittiBtn: {
    top: -28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  chittiOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#050810',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(99,102,241,0.25)',
    elevation: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  chittiInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  chittiAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  chittiLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 4,
  },
});
