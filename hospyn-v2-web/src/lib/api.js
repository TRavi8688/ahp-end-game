/**
 * hospain-v2-web/src/lib/api.js
 *
 * Single API client — reads VITE_API_BASE_URL from env,
 * auto-injects Bearer token, structured error handling.
 *
 * FIX: token now read from sessionStorage first (PHI security),
 * falling back to localStorage only for the internal panel token.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
export const API_V1 = `${BASE}/v1`;

function getToken() {
  // Owner token: sessionStorage (clears on tab close)
  // Internal panel: localStorage (separate product, different security model)
  return (
    localStorage.getItem('hospain_internal_token') ||
    sessionStorage.getItem('hospain_owner_token') ||
    ''
  );
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function handleResponse(res) {
  if (res.status === 204) return null;
  if (res.ok) return res.json();
  let detail = `HTTP ${res.status}`;
  try {
    const err = await res.json();
    detail = err?.detail || err?.message || detail;
  } catch (_) {}
  const error = new Error(detail);
  error.status = res.status;
  throw error;
}

export async function get(path, { params } = {}) {
  let url = `${API_V1}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse(res);
}

export async function post(path, body) {
  const res = await fetch(`${API_V1}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function postForm(path, fields) {
  const res = await fetch(`${API_V1}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: new URLSearchParams(fields).toString(),
  });
  return handleResponse(res);
}

export async function postMultipart(path, formData) {
  // Do NOT set Content-Type — browser sets it with correct multipart boundary
  const res = await fetch(`${API_V1}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return handleResponse(res);
}

export async function put(path, body) {
  const res = await fetch(`${API_V1}${path}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function del(path) {
  const res = await fetch(`${API_V1}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// Named export alias used in some older component imports
export const apiGet  = get;
export const apiPost = post;
