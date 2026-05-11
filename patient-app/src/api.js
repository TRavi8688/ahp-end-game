import { Platform } from 'react-native';

// --- API CONFIGURATION ---
// Priority: Env Variable > Local Dev (port 8000) > Production Fallback

const getBaseUrl = () => {
    // 1. Use explicit env var if set (for production deployments)
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
        return process.env.EXPO_PUBLIC_API_BASE_URL;
    }

    // 2. For local development on web, point to the FastAPI backend port
    //    (NOT window.location which gives the Expo dev server port 8081)
    if (Platform.OS === 'web') {
        const { protocol, hostname } = window.location;
        // Always use port 8000 for the backend in local dev
        return `${protocol}//${hostname}:8000`;
    }

    // 3. Native: use localhost for dev, override via env var for production
    return 'https://hospyn-495906-api-7ixs2fhkna-uc.a.run.app';
};

const BASE = getBaseUrl();

export const API_BASE_URL = `${BASE}/api/v1`;

export const WS_BASE_URL = BASE.startsWith('https')
    ? BASE.replace('https', 'wss')
    : BASE.replace('http', 'ws');

// console.log(`[Hospyn Network] Core Endpoint: ${API_BASE_URL}`);
