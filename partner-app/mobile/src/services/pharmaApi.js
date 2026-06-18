// ============================================================
// pharmaApi.js — Central API service for Pharma Mobile App
// Place at: pharma-mobile-app/src/services/pharmaApi.js
// ============================================================

import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = 'pharma_auth_token';
const USER_KEY = 'pharma_user';

// ── Navigation ref (set from App.js) ────────────────────────
let _navigationRef = null;
export const setNavigationRef = (ref) => { _navigationRef = ref; };

// ── Token helpers ────────────────────────────────────────────
export const saveToken = async (token) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const getToken = async () => SecureStore.getItemAsync(TOKEN_KEY);
export const clearToken = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
};
export const saveUser = async (user) => SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
export const getUser = async () => {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

// ── Core fetch wrapper ───────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = await getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // 401 → clear auth + redirect to Login
  if (res.status === 401) {
    await clearToken();
    if (_navigationRef?.isReady()) {
      _navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
    throw new Error('Session expired. Please log in again.');
  }

  // Non-2xx errors
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch (_) {}
    throw new Error(detail);
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────

export const sendOTP = (phone) =>
  apiFetch('/api/v1/healthcare/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, role: 'pharmacist' }),
  });

export const verifyOTP = async (phone, otp) => {
  const data = await apiFetch('/api/v1/healthcare/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
  if (data.access_token) {
    await saveToken(data.access_token);
    if (data.user) await saveUser(data.user);
  }
  return data;
};

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────

export const getDashboard = () =>
  apiFetch('/api/v1/healthcare/pharmacy/dashboard');

export const getWeeklyDispensingVolume = () =>
  apiFetch('/api/v1/healthcare/pharmacy/dashboard/weekly-dispensing');

// ─────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────

export const getInventory = ({ hospitalId, page = 1, limit = 20 } = {}) =>
  apiFetch(`/api/v1/healthcare/pharmacy/inventory?hospital_id=${hospitalId}&page=${page}&limit=${limit}`);

export const restockMedicine = (medicineId, quantity) =>
  apiFetch(`/api/v1/healthcare/pharmacy/inventory/${medicineId}/restock`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });

// ─────────────────────────────────────────────────────────────
// PRESCRIPTIONS
// ─────────────────────────────────────────────────────────────

export const getPendingPrescriptions = (date = 'today') =>
  apiFetch(`/api/v1/healthcare/pharmacy/prescriptions?status=pending&date=${date}`);

export const dispensePrescription = (prescriptionId) =>
  apiFetch(`/api/v1/healthcare/pharmacy/prescriptions/${prescriptionId}/dispense`, {
    method: 'PATCH',
  });

// ─────────────────────────────────────────────────────────────
// QR SCANNER
// ─────────────────────────────────────────────────────────────

export const scanBarcode = (barcode) =>
  apiFetch(`/api/v1/healthcare/pharmacy/medicine/scan?barcode=${encodeURIComponent(barcode)}`);
