// super-admin-dashboard/src/lib/apiClient.js
// FIXED:
//   1. tokenStore is exported so authStore.js can call tokenStore.set() on login
//   2. tokenStore.clear() available for logout
//   3. All requests automatically include Bearer token from in-memory store
//   4. 401 auto-logout: redirects to /login and clears token

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── In-memory token store (NO localStorage — PHI security requirement) ─────
export const tokenStore = (() => {
  let _token = null;
  return {
    get:   ()    => _token,
    set:   (t)   => { _token = t; },
    clear: ()    => { _token = null; },
  };
})();

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function request(method, path, body, extraHeaders = {}) {
  const token = tokenStore.get();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };

  const config = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, config);

  // Auto-logout on 401
  if (res.status === 401) {
    tokenStore.clear();
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired — please log in again');
  }

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      errMsg = errBody?.detail || errBody?.message || errMsg;
    } catch (_) { /* ignore parse error */ }
    throw new Error(errMsg);
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const api = {
  get:    (path, headers)       => request('GET',    path, undefined, headers),
  post:   (path, body, headers) => request('POST',   path, body,      headers),
  put:    (path, body, headers) => request('PUT',    path, body,      headers),
  patch:  (path, body, headers) => request('PATCH',  path, body,      headers),
  delete: (path, headers)       => request('DELETE', path, undefined, headers),
};

export default api;
