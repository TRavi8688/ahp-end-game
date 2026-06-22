/**
 * doctorService.js
 * Phase 3 Fix: Doctor App — API service wiring for all Phase 3 routes
 *
 * APPLY TO: doctor-app/src/services/doctorService.js  (create or replace)
 *
 * Uses httpOnly cookie auth (no localStorage token for doctor-app).
 * All fetch calls include credentials: "include" so the browser sends the cookie.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const headers = (extra = {}) => ({
  "Content-Type": "application/json",
  ...extra,
});

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    credentials: "include",   // send httpOnly JWT cookie
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });

  if (res.status === 401) {
    // Session expired — redirect to login
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
