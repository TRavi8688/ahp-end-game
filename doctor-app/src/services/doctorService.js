/**
 * doctorService.js
 *
 * FIXED: this file assumed httpOnly-cookie auth ("credentials: include",
 * no Authorization header at all) — but the backend's login endpoint
 * returns a JSON { access_token } body, not a cookie (confirmed in
 * LoginScreen.jsx). No cookie is ever set, so every call through this file
 * always 401'd silently before this fix.
 *
 * Also fixed the same missing-prefix issue as Staff Portal: healthcare-core
 * mounts everything under /api/v1/healthcare/*, not /api/v1/*.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const headers = (extra = {}) => {
  const token = sessionStorage.getItem('hospain_access_token');
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};

async function apiFetch(path, options = {}) {
  // FIXED: was `/api/v1${path}` — healthcare-core routes live under
  // /api/v1/healthcare/*, not directly under /api/v1/*.
  const res = await fetch(`${API_BASE}/api/v1/healthcare${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });

  if (res.status === 401) {
    // Session expired — redirect to login
    sessionStorage.removeItem('hospain_access_token');
    window.location.href = "/login";
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Doctor stats ──────────────────────────────────────────────────────────
export const getStats = () => apiFetch("/doctor/stats");

// ── Alerts ───────────────────────────────────────────────────────────────
export const getAlerts = () => apiFetch("/doctor/alerts");

// ── Access history ────────────────────────────────────────────────────────
export const getAccessHistory = (limit = 50) =>
  apiFetch(`/doctor/access-history?limit=${limit}`);

// ── Emergency broadcast ────────────────────────────────────────────────────
export const broadcastEmergency = (payload) =>
  apiFetch("/doctor/emergency/broadcast", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ── Break management ──────────────────────────────────────────────────────
export const startBreak = () =>
  apiFetch("/doctor/session/break/start", { method: "POST" });

export const endBreak = () =>
  apiFetch("/doctor/session/break/end", { method: "POST" });

// ── Queue ─────────────────────────────────────────────────────────────────
export const getQueue = () => apiFetch("/doctor/queue");

// ── Auth ──────────────────────────────────────────────────────────────────
export const logout = () =>
  apiFetch("/auth/logout", { method: "POST" });

export const doctorService = {
  getStats,
  getAlerts,
  getAccessHistory,
  broadcastEmergency,
  startBreak,
  endBreak,
  getQueue,
  logout,
};

export default doctorService;
