// HOSPAIN Partner App — Central API configuration
// Production URL is read from VITE_API_BASE_URL env var (set in GCP Cloud Run
// environment variables or CI/CD secrets — never hardcoded in source).
const getBackendUrl = () => {
  try {
    if (import.meta.env?.VITE_API_BASE_URL) {
      // Strip trailing /api/v1 if already present so we don't double-append
      return import.meta.env.VITE_API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    }
  } catch (e) {}

  // Local dev fallback only
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
  ) {
    return 'http://localhost:8000';
  }

  // No hardcoded production URL — fail loudly so misconfiguration is obvious
  console.error(
    '[HOSPAIN Partner] VITE_API_BASE_URL is not set. ' +
    'Set it in GCP Cloud Run environment variables.'
  );
  return '';
};

const BACKEND_URL = getBackendUrl();
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;

if (import.meta.env?.DEV) {
  console.log(`[HOSPAIN Partner] API Base URL: ${API_BASE_URL}`);
}
