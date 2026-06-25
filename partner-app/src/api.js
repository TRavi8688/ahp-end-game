// HOSPAIN Partner App — Central API configuration
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
    // Production Cloud Run backend
    return "https://hospyn-495906-api-625745217419.asia-south1.run.app";
};

const BACKEND_URL = getBackendUrl();
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;

if (import.meta.env?.DEV) {
    console.log(`[HOSPAIN Partner] API Base URL: ${API_BASE_URL}`);
}
