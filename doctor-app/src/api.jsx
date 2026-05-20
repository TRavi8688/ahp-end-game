// Central API configuration for Doctor App
const getBackendUrl = () => {
    if (typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' || 
         window.location.hostname.startsWith('192.168.'))) {
        return "http://localhost:8000";
    }
    return "https://hospyn-495906-api-625745217419.us-central1.run.app";
};

const BACKEND_URL = getBackendUrl();
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;
export const WS_BASE_URL = BACKEND_URL.startsWith('https')
    ? BACKEND_URL.replace("https://", "wss://")
    : BACKEND_URL.replace("http://", "ws://");

console.log(`[Doctor Config] API Base URL: ${API_BASE_URL}`);
