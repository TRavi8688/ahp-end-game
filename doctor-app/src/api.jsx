// Central API configuration for Doctor App
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "https://hospyn-495906-api-7ixs2fhkna-uc.a.run.app";
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 
    BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://");

console.log(`[Doctor Config] API Base URL: ${API_BASE_URL}`);
