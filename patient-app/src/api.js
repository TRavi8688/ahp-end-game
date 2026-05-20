import { Platform } from 'react-native';

// --- API CONFIGURATION ---
// Priority: Env Variable > Local Dev (port 8000) > Production Fallback

const getBaseUrl = () => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // In Expo / React Native, Platform.OS determines Android vs iOS/Web
        try {
            const { Platform } = require('react-native');
            if (Platform.OS === 'android') {
                return 'http://10.0.2.2:8000';
            }
        } catch (e) {}
        return 'http://localhost:8000';
    }
    return 'https://hospyn-495906-api-625745217419.us-central1.run.app';
};


const BASE = getBaseUrl();

export const API_BASE_URL = `${BASE}/api/v1`;

export const WS_BASE_URL = BASE.startsWith('https')
    ? BASE.replace('https', 'wss')
    : BASE.replace('http', 'ws');

// --- GOOGLE OAUTH CLIENT CONFIGURATION ---
// Replace with the Google Web Client ID generated for your GCP Project: hospyn-495906-96438
export const GOOGLE_CLIENT_ID = '625745217419-cq76tvb0mlt0bkmg8bd4r0csj4vmqmr8.apps.googleusercontent.com';

