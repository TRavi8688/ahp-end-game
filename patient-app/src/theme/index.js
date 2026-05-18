import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let currentTheme = 'light'; // Default is Light (as requested by user)
const listeners = new Set();

export const getTheme = () => currentTheme;

export const setTheme = async (themeName) => {
    if (themeName !== 'light' && themeName !== 'dark') return;
    currentTheme = themeName;
    try {
        await AsyncStorage.setItem('HOSPYN_THEME', themeName);
    } catch (e) {}
    listeners.forEach(cb => cb(themeName));
};

export const subscribeToTheme = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

// Initialize theme from storage early
AsyncStorage.getItem('HOSPYN_THEME').then(val => {
    if (val) {
        currentTheme = val;
        listeners.forEach(cb => cb(val));
    }
});

const lightColors = {
    background: '#F8F7FF',       // Soft premium lavender-white from screenshot
    primary: '#7C3AED',          // Vibrant Royal Violet/Purple from screenshot header
    secondary: '#64748B',        // Slate-500
    positive: '#10B981',
    warning: '#F59E0B',
    critical: '#EF4444',
    border: '#E2E8F0',
    black: '#000000',
    white: '#FFFFFF',
    text: '#0F172A',             // Dark Slate text
    textMuted: '#475569',
    card: '#FFFFFF',             // Solid white cards
    glassBg: 'rgba(255, 255, 255, 0.8)',
    glassBorder: 'rgba(124, 58, 237, 0.1)',
};

const darkColors = {
    background: '#050810',       // Dark Space
    primary: '#6366F1',          // Premium Indigo
    secondary: '#94A3B8',        // Slate-400
    positive: '#10B981',
    warning: '#F59E0B',
    critical: '#EF4444',
    border: '#1E293B',
    black: '#000000',
    white: '#FFFFFF',
    text: '#FFFFFF',             // Clean White text
    textMuted: '#94A3B8',
    card: 'rgba(255, 255, 255, 0.04)',
    glassBg: 'rgba(255, 255, 255, 0.04)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
};

export const Theme = {
    get colors() {
        return currentTheme === 'light' ? lightColors : darkColors;
    },
    fonts: {
        heading: 'Syne_800ExtraBold',
        headingSemi: 'Syne_700Bold',
        label: 'SpaceMono_400Regular',
        body: 'DMSans_400Regular',
    }
};

export const GlobalStyles = {
    get screen() {
        return {
            flex: 1,
            backgroundColor: Theme.colors.background,
        };
    },
    get heading() {
        return {
            fontFamily: Theme.fonts.heading,
            color: Theme.colors.text,
        };
    },
    get label() {
        return {
            fontFamily: Theme.fonts.label,
            color: Theme.colors.secondary,
            textTransform: 'uppercase',
            letterSpacing: 1,
        };
    },
    get body() {
        return {
            fontFamily: Theme.fonts.body,
            color: Theme.colors.text,
        };
    },
    get sharpBorder() {
        return {
            borderWidth: 1,
            borderColor: Theme.colors.text,
            borderRadius: 0,
        };
    },
    get glass() {
        return {
            backgroundColor: Theme.colors.glassBg,
            borderWidth: 1,
            borderColor: Theme.colors.glassBorder,
        };
    },
    get shadow() {
        return {
            shadowColor: Theme.colors.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: currentTheme === 'light' ? 0.08 : 0.1,
            shadowRadius: 20,
            elevation: 10,
        };
    }
};
