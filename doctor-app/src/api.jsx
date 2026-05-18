// Central API configuration for Doctor App
const BACKEND_URL = "https://hospyn-api-625745217419.asia-south1.run.app";
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;
export const WS_BASE_URL = BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://");

console.log(`[Doctor Config] API Base URL: ${API_BASE_URL}`);
