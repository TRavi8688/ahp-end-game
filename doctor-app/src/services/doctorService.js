/**
 * doctorService.js
 *
 * FIXED (this pass):
 *  - Added getProfile() — Topbar.jsx and HomeDashboard.jsx both call
 *    doctorService.getProfile() but it never existed on this module, so
 *    every page load threw a TypeError and silently aborted the
 *    Promise.all() in HomeDashboard, leaving the dashboard permanently
 *    empty even when every other call would have succeeded.
 *  - apiFetch() no longer blanket-prefixes every path with /healthcare.
 *    /auth/logout lives on auth-service at /api/v1/auth/logout, not under
 *    healthcare-core's /api/v1/healthcare/*. The old version sent logout
 *    to a path that doesn't exist.
 *  - VITE_API_BASE_URL now must already include /api/v1 (see .env) — this
 *    file no longer assumes a bare host.
 *
 * Uses the real Bearer-token auth this app actually has (JSON
 * { access_token } body, stored in sessionStorage by LoginScreen.jsx) —
 * not httpOnly cookies, which the backend does not issue for this flow.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// Paths that must NOT get /healthcare prepended — these live on auth-service
// (mounted at /api/v1/auth/*) or other sibling services, not healthcare-core.
const PASSTHROUGH_PREFIXES = ['/auth', '/ai', '/notifications', '/healthcare'];

function withHealthcarePrefix(path) {
  if (!path) return path;
  if (PASSTHROUGH_PREFIXES.some((p) => path.startsWith(p))) return path;
  return `/healthcare${path}`;
}

const headers = (extra = {}) => {
  const token = sessionStorage.getItem('hospain_access_token');
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${withHealthcarePrefix(path)}`, {
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
    // Backend error_response() shape uses `message`, not `detail` — accept either.
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Profile ────────────────────────────────────────────────────────────────
export const getProfile = () => apiFetch("/doctor/profile/me");

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
// FIXED: was being routed through /healthcare/auth/logout, which does not
// exist. /auth/* is on auth-service, reached directly without the
// /healthcare segment (see PASSTHROUGH_PREFIXES above).
export const logout = () =>
  apiFetch("/auth/logout", { method: "POST" });

export const doctorService = {
  getProfile,
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
