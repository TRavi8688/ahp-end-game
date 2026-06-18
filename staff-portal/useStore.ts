// src/store/useStore.ts — PATCHED VERSION
// Changes from your current version:
//   • Added `hospitalId` field — required by Settings.tsx and OwnerDashboard.tsx
//   • Added `token` field — referenced by all new dashboard files
//   • All other fields (queue, alerts, systemStatus) preserved exactly
//
// If your current useStore.ts already has token and hospitalId, skip this file.
// Otherwise merge these additions into your existing store.

import { create } from "zustand";

interface QueueEntry {
  id: string;
  patient_name: string;
  token_number: string;
  status: string;
}

interface Alert {
  id: string;
  message: string;
  severity: "info" | "warning" | "error";
  created_at: string;
}

interface AppStore {
  // ── Auth (NEW fields required by v2 dashboards) ──────────
  token: string | null;
  hospitalId: string | null;
  userRole: string | null;
  setToken: (token: string | null) => void;
  setHospitalId: (id: string | null) => void;
  setUserRole: (role: string | null) => void;

  // ── Queue ───────────────────────────────────────────────
  queue: QueueEntry[];
  setQueue: (queue: QueueEntry[]) => void;
  addToQueue: (entry: QueueEntry) => void;
  updateQueueEntry: (id: string, updates: Partial<QueueEntry>) => void;

  // ── Alerts ──────────────────────────────────────────────
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  dismissAlert: (id: string) => void;

  // ── System ──────────────────────────────────────────────
  systemStatus: "online" | "degraded" | "offline";
  setSystemStatus: (status: "online" | "degraded" | "offline") => void;
}

const useStore = create<AppStore>((set) => ({
  // Auth
  token: localStorage.getItem("hospyn_staff_token"),
  hospitalId: localStorage.getItem("hospyn_hospital_id"),
  userRole: localStorage.getItem("hospyn_role"),
  setToken: (token) => {
    if (token) localStorage.setItem("hospyn_staff_token", token);
    else localStorage.removeItem("hospyn_staff_token");
    set({ token });
  },
  setHospitalId: (id) => {
    if (id) localStorage.setItem("hospyn_hospital_id", id);
    else localStorage.removeItem("hospyn_hospital_id");
    set({ hospitalId: id });
  },
  setUserRole: (role) => {
    if (role) localStorage.setItem("hospyn_role", role);
    else localStorage.removeItem("hospyn_role");
    set({ userRole: role });
  },

  // Queue
  queue: [],
  setQueue: (queue) => set({ queue }),
  addToQueue: (entry) => set((s) => ({ queue: [...s.queue, entry] })),
  updateQueueEntry: (id, updates) =>
    set((s) => ({
      queue: s.queue.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  // Alerts
  alerts: [],
  addAlert: (alert) => set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 50) })),
  dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

  // System
  systemStatus: "online",
  setSystemStatus: (systemStatus) => set({ systemStatus }),
}));

export default useStore;
