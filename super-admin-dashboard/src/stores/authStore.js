import { create } from 'zustand';
import { tokenStore } from '../lib/apiClient';

/**
 * Super Admin Auth Store
 * Holds session state for the super-admin dashboard.
 * Token lives in memory only — never localStorage (PHI requirement).
 */
export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  login: (user, token) => {
    tokenStore.set(token);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    tokenStore.clear();
    set({ user: null, isAuthenticated: false });
  },
}));
