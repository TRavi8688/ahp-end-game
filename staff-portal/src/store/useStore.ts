import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Patient {
  id: string;
  name: string;
  age: number;
  priority: number;
  status: string;
  zone: string;
  wait: string;
  type: 'Emergency' | 'VIP' | 'Regular';
}

interface Alert {
  id: string;
  type: 'critical' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
}

interface AppState {
  queue: Patient[];
  alerts: Alert[];
  systemStatus: {
    latency: string;
    dbLoad: string;
    cpu: string;
  };
  setQueue: (queue: Patient[]) => void;
  updatePatient: (patientId: string, updates: Partial<Patient>) => void;
  addAlert: (alert: Alert) => void;
  setSystemStatus: (status: AppState['systemStatus']) => void;
  clearAlerts: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      queue: [],
      alerts: [],
      systemStatus: {
        latency: '0ms',
        dbLoad: '0%',
        cpu: '0%',
      },
      setQueue: (queue) => set({ queue }),
      updatePatient: (patientId, updates) =>
        set((state) => ({
          queue: state.queue.map((p) =>
            p.id === patientId ? { ...p, ...updates } : p
          ),
        })),
      addAlert: (alert) =>
        set((state) => ({
          alerts: [alert, ...state.alerts].slice(0, 50),
        })),
      setSystemStatus: (status) => set({ systemStatus: status }),
      clearAlerts: () => set({ alerts: [] }),
    }),
    {
      name: 'hospyn-staff-storage',
      storage: createJSONStorage(() => sessionStorage),
      // FIXED (BUG-29 / PHI in localStorage): queue AND alerts are excluded
      // from persistence. `alerts` can contain patient names, zones, and
      // critical clinical flags — this is PHI and must never be written to
      // localStorage (survives browser close, readable indefinitely).
      // Only non-PHI `systemStatus` persists, now in sessionStorage
      // (cleared on tab close) for consistency with the auth token storage.
      partialize: (state) => ({
        systemStatus: state.systemStatus,
      }),
    }
  )
);
