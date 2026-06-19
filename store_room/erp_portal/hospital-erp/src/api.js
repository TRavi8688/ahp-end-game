// Central API configuration for Hospital ERP
const getBackendUrl = () => {
    try {
        if (import.meta.env && import.meta.env.VITE_API_BASE_URL) {
            return import.meta.env.VITE_API_BASE_URL.replace(/\/api\/v1\/?$/, '');
        }
    } catch (e) {}

    if (typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1')) {
        return "http://localhost:8000";
    }
    return "https://hospyn-495906-api-625745217419.us-central1.run.app";
};

const BACKEND_URL = getBackendUrl();
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;

console.log(`[ERP Config] API Base URL: ${API_BASE_URL}`);
