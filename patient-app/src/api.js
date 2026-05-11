import { Platform } from 'react-native';

// --- API CONFIGURATION ---
// Priority: Env Variable > Local Dev (port 8000) > Production Fallback

    // Always use the production cloud API for consistency during testing
    return 'https://hospyn-495906-api-7ixs2fhkna-uc.a.run.app';
};

const BASE = getBaseUrl();

export const API_BASE_URL = `${BASE}/api/v1`;

export const WS_BASE_URL = BASE.startsWith('https')
    ? BASE.replace('https', 'wss')
    : BASE.replace('http', 'ws');

// console.log(`[Hospyn Network] Core Endpoint: ${API_BASE_URL}`);
