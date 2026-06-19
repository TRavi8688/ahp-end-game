/**
 * doctor-app/src/store/useAuthStore.js
 * Phase 5 Fix — Zustand auth store, replaces prop-drilling useState
 *
 * COPY TO: doctor-app/src/store/useAuthStore.js
 * INSTALL: npm install zustand
 *
 * Usage in any component:
 *   import useAuthStore from "../store/useAuthStore";
 *   const { token, user, login, logout, getAuthHeaders } = useAuthStore();
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      // ── Actions ────────────────────────────────────────────────────────────
      login: (token, refreshToken, user) =>
        set({ token, refreshToken, user, isAuthenticated: true }),

      logout: () =>
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false }),

      updateUser: (userData) =>
        set({ user: { ...get().user, ...userData } }),

      setToken: (token) => set({ token }),

      // ── Helpers ────────────────────────────────────────────────────────────
      /** Returns Authorization header object, or empty if not authenticated */
      getAuthHeaders: () => {
        const { token } = get();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    {
      name: "hospyn-auth-doctor",
      // Only persist auth state — not UI derived state
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
