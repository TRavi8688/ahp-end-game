// super-admin-dashboard/src/stores/authStore.js
// FIXED:
//   1. Uses zustand (added to package.json)
//   2. Token stored in tokenStore (in-memory) via lib/apiClient — NOT localStorage
//   3. login() sets the token in tokenStore so all api calls are automatically authenticated
//   4. logout() clears both the store state and the tokenStore

import { create } from 'zustand';
import { tokenStore } from '../lib/apiClient';

export const useAuthStore = create((set) => ({
  user:            null,
  isAuthenticated: false,

  login: (user, token) => {
    tokenStore.set(token);                       // in-memory only — no PHI in storage
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    tokenStore.clear();
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (updates) =>
    set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
}));
