// Central API configuration for Doctor App
const getBackendUrl = () => {
    // 1. React Native / Expo Web fallback
    if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL) {
        return process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    }
    // 2. Vite Web fallback
    try {
        if (import.meta.env && import.meta.env.VITE_API_BASE_URL) {
            return import.meta.env.VITE_API_BASE_URL.replace(/\/api\/v1\/?$/, '');
        }
    } catch (e) {}

    // 3. Localhost override
    if (typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' || 
         window.location.hostname.startsWith('192.168.'))) {
        return "http://localhost:8000";
    }
    // 4. Production Failsafe
    return "https://hospyn-495906-api-625745217419.us-central1.run.app";
};

const BACKEND_URL = getBackendUrl();
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;
export const WS_BASE_URL = BACKEND_URL.startsWith('https')
    ? BACKEND_URL.replace("https://", "wss://")
    : BACKEND_URL.replace("http://", "ws://");

console.log(`[Doctor Config] API Base URL: ${API_BASE_URL}`);
