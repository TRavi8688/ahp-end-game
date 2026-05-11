// Central API configuration for Doctor App
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "https://hospyn-495906-api-7ixs2fhkna-uc.a.run.app";
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 
    (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}` : 'ws://localhost:8000');

console.log(`[Doctor Config] API Base URL: ${API_BASE_URL}`);
