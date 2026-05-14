import { Platform } from 'react-native';

// --- API CONFIGURATION ---
// Priority: Env Variable > Local Dev (port 8000) > Production Fallback

const getBaseUrl = () => {
    // 1. Check EXPO_PUBLIC_API_BASE_URL (env)
    const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (envUrl) return envUrl.replace('/api/v1', '');

    // 2. Local Dev Fallback (matched to your current uvicorn port 8080)
    return 'http://localhost:8080';
};


const BASE = getBaseUrl();

export const API_BASE_URL = `${BASE}/api/v1`;

export const WS_BASE_URL = BASE.startsWith('https')
    ? BASE.replace('https', 'wss')
    : BASE.replace('http', 'ws');

// console.log(`[Hospyn Network] Core Endpoint: ${API_BASE_URL}`);
