/**
 * Reception API Service
 * All backend calls for the Reception (Staff Portal) module.
 * Base URL is read from Vite env; falls back to localhost for dev.
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const authHeader = () => {
  const token = localStorage.getItem("staff_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async (method, path, body = null, signal = null) => {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    signal,
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);

  if (res.status === 401) {
    localStorage.removeItem("staff_token");
    window.location.href = "/login";
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
};

/* ─── AUTH ────────────────────────────────────────────────────────────── */
export const login = (email, password) =>
  request("POST", "/auth/login", { email, password });

export const refreshToken = () =>
  request("POST", "/auth/refresh");

/* ─── PATIENTS ────────────────────────────────────────────────────────── */
export const searchPatients = (q, signal) =>
  request("GET", `/patients/search?q=${encodeURIComponent(q)}`, null, signal);

export const getPatient = (id) =>
  request("GET", `/patients/${id}`);

export const registerPatient = (data) =>
  request("POST", "/patients", data);

export const updatePatient = (id, data) =>
  request("PUT", `/patients/${id}`, data);

/* ─── DOCTORS / DEPARTMENTS ───────────────────────────────────────────── */
export const getAvailableDoctors = (hospitalId) =>
  request("GET", `/doctors?hospital_id=${hospitalId}&available_now=true`);

export const getAllDoctors = (hospitalId) =>
  request("GET", `/doctors?hospital_id=${hospitalId}`);

export const getDepartments = (hospitalId) =>
  request("GET", `/departments?hospital_id=${hospitalId}`);

/* ─── QUEUE ───────────────────────────────────────────────────────────── */
export const issueToken = (payload) =>
  request("POST", "/queue/token", payload);
// payload: { patient_id, doctor_id, hospital_id, type: "walk_in"|"appointment"|"emergency" }

export const getLiveQueue = (hospitalId) =>
  request("GET", `/queue/live?hospital_id=${hospitalId}`);

export const callNextToken = (doctorId) =>
  request("POST", `/queue/next`, { doctor_id: doctorId });

export const cancelToken = (tokenId) =>
  request("DELETE", `/queue/token/${tokenId}`);

export const reprioritizeToken = (tokenId, priority) =>
  request("PATCH", `/queue/token/${tokenId}/priority`, { priority });

/* ─── APPOINTMENTS ────────────────────────────────────────────────────── */
export const getTodaysAppointments = (hospitalId) => {
  const today = new Date().toISOString().split("T")[0];
  return request("GET", `/appointments?hospital_id=${hospitalId}&date=${today}`);
};

export const checkInAppointment = (appointmentId) =>
  request("POST", `/appointments/${appointmentId}/checkin`);

/* ─── WEBSOCKET ───────────────────────────────────────────────────────── */
export const createQueueSocket = (hospitalId, onMessage, onClose) => {
  const wsBase = BASE.replace(/^http/, "ws");
  const token = localStorage.getItem("staff_token");
  const ws = new WebSocket(`${wsBase}/ws/queue/${hospitalId}?token=${token}`);

  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      /* ignore malformed frames */
    }
  };

  ws.onclose = () => onClose?.();

  ws.onerror = (err) => console.error("Queue WS error", err);

  return ws;
};
