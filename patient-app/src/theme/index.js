import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

let currentTheme = 'light'; // Default is Light (as requested by user)
const listeners = new Set();

export const getTheme = () => currentTheme;

export const setTheme = async (themeName) => {
    if (themeName !== 'light' && themeName !== 'dark') return;
    currentTheme = themeName;
    try {
        await AsyncStorage.setItem('HOSPAIN_THEME', themeName);
    } catch (e) {}
    listeners.forEach(cb => cb(themeName));
};

export const subscribeToTheme = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

// Initialize theme from storage early
AsyncStorage.getItem('HOSPAIN_THEME').then(val => {
    if (val) {
        currentTheme = val;
        listeners.forEach(cb => cb(val));
    }
});

// ── Hospain brand palette ───────────────────────────────────────────────────
// Navy-to-steel-blue, taken directly from the logo gradient (deep navy
// #0B2545 -> mid navy #13396B -> steel blue #2E6BA8 -> light sky #6FA0D6).
const lightColors = {
    background: '#F4F7FB',       // Soft cool off-white
    primary: '#13396B',          // Mid navy (brand primary)
    primaryDark: '#0B2545',      // Deepest navy (headers/gradients)
    accent: '#2E6BA8',           // Steel blue (links, secondary accents)
    secondary: '#5B7A99',        // Muted slate-blue
    positive: '#10B981',
    warning: '#F59E0B',
    critical: '#DC2626',
    border: '#E2E8F0',
    black: '#000000',
    white: '#FFFFFF',
    text: '#0B2545',             // Deep navy text (on-brand, high contrast on light bg)
    textMuted: '#5B7A99',
    card: '#FFFFFF',
    glassBg: 'rgba(255, 255, 255, 0.85)',
    glassBorder: 'rgba(11, 37, 69, 0.08)',
    gradientStart: '#0B2545',
    gradientEnd: '#2E6BA8',
};

const darkColors = {
    background: '#070D17',       // Near-black navy
    primary: '#5B9BD5',          // Bright sky-blue (readable on dark bg)
    primaryDark: '#13396B',
    accent: '#6FA0D6',
    secondary: '#94A3B8',
    positive: '#10B981',
    warning: '#F59E0B',
    critical: '#EF4444',
    border: '#1E2A3D',
    black: '#000000',
    white: '#FFFFFF',
    text: '#F1F5F9',             // Off-white (softer than pure white)
    textMuted: '#8DA3BD',
    card: '#0F1B2E',             // Solid dark navy card, distinct from bg
    glassBg: 'rgba(255, 255, 255, 0.06)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    gradientStart: '#0B2545',
    gradientEnd: '#2E6BA8',
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

// BUG FIX (the "switch to dark mode and text disappears" issue): components
// that read Theme.colors.X directly inside a module-scope StyleSheet.create()
// only evaluate that getter ONCE, the moment the file is first imported —
// not on every theme change, and not even on every screen mount. Toggling
// the theme afterwards never touches those already-built style objects, so
// some elements stay frozen at whatever colors were active at app launch
// (usually the 'light' default, since the saved preference loads from
// AsyncStorage asynchronously, after that first StyleSheet.create() already
// ran) while other elements that *do* read colors fresh each render update
// normally — producing exactly the "some things match, some don't, some
// text is invisible" symptom.
//
// useTheme() is the fix: it subscribes to theme changes and forces a
// re-render, so screens can compute their styles fresh each render via
// `getStyles(colors)` instead of baking them in at import time.
export function useTheme() {
    const [theme, setThemeState] = useState(currentTheme);
    useEffect(() => {
        const unsubscribe = subscribeToTheme((t) => setThemeState(t));
        return unsubscribe;
    }, []);
    return {
        theme,
        isDark: theme === 'dark',
        colors: theme === 'light' ? lightColors : darkColors,
        fonts: Theme.fonts,
    };
}

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
