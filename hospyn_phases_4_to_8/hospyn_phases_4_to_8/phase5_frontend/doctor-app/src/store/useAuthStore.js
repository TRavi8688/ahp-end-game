/**
 * useAuthStore.js
 * Phase 5 Fix: Zustand auth store for doctor-app
 *
 * APPLY TO: doctor-app/src/store/useAuthStore.js
 *
 * Install dependency first:
 *   npm install zustand
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      // Actions
      login: (token, refreshToken, user) =>
        set({ token, refreshToken, user, isAuthenticated: true }),

      logout: () =>
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false }),

      updateUser: (userData) =>
        set({ user: { ...get().user, ...userData } }),

      setToken: (token) => set({ token }),

      // Helpers
      getAuthHeaders: () => {
        const { token } = get();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    {
      name: "hospyn-auth-doctor",
      // Only persist these fields — don't persist derived state
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
