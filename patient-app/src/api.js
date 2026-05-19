import { Platform } from 'react-native';

// --- API CONFIGURATION ---
// Priority: Env Variable > Local Dev (port 8000) > Production Fallback

const getBaseUrl = () => {
    // Maintain ONLY cloud servers (production)
    return 'https://hospyn-495906-api-625745217419.us-central1.run.app';
};


const BASE = getBaseUrl();

export const API_BASE_URL = `${BASE}/api/v1`;

export const WS_BASE_URL = BASE.startsWith('https')
    ? BASE.replace('https', 'wss')
    : BASE.replace('http', 'ws');

// --- GOOGLE OAUTH CLIENT CONFIGURATION ---
// Replace with the Google Web Client ID generated for your GCP Project: hospyn-495906-96438
export const GOOGLE_CLIENT_ID = '625745217419-g5j6scb7d1hl0s9l2o1e93t6401sf0x.apps.googleusercontent.com';

