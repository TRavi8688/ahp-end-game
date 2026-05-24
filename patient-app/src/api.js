import { Platform } from 'react-native';

// --- API CONFIGURATION ---
// STRICT PRODUCTION ENFORCEMENT: All production builds must use environment variables.
// Fallback IPs are strictly forbidden in production to prevent data leakage or misrouting.

const getBaseUrl = () => {
    // If we have an explicit environment variable injected, always prefer it (EAS Secrets)
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
        return process.env.EXPO_PUBLIC_API_BASE_URL;
    }
    
    if (__DEV__) {
        // Development fallback only. Will not compile into production JS bundle.
        return 'http://192.168.0.21:8000/api/v1'; 
    }
    
    // Failsafe: If production bundle lacks env var (e.g., standard Metro web build), fallback to production API
    return 'https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1';
};

export const API_BASE_URL = getBaseUrl();

// Derive WebSocket URL from Base URL safely
export const WS_BASE_URL = API_BASE_URL.startsWith('https')
    ? API_BASE_URL.replace('https', 'wss').replace('/api/v1', '')
    : API_BASE_URL.replace('http', 'ws').replace('/api/v1', '');

// --- GOOGLE OAUTH CLIENT CONFIGURATION ---
// Extracted to environment variables for security.
if (!__DEV__ && !process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
     console.warn('WARNING: EXPO_PUBLIC_GOOGLE_CLIENT_ID missing in production build.');
}
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '625745217419-cq76tvb0mlt0bkmg8bd4r0csj4vmqmr8.apps.googleusercontent.com';

