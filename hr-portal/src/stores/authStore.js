import { create } from 'zustand';
import { tokenStore } from '../lib/apiClient';

/**
 * HR Portal Auth Store
 * Holds current user identity and hospital context.
 * Token is stored in memory via tokenStore — never in localStorage.
 */
export const useAuthStore = create((set) => ({
  user: null,
  hospitalId: null,
  isAuthenticated: false,

  login: (user, token, hospitalId) => {
    tokenStore.set(token);
    set({ user, hospitalId, isAuthenticated: true });
  },

  logout: () => {
    tokenStore.clear();
    set({ user: null, hospitalId: null, isAuthenticated: false });
  },
}));
