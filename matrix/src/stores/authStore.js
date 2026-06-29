/**
 * src/stores/authStore.js — Hospin Matrix 3.0
 * FIX: logout now calls matrixStore.resetAll() to clear stale employee data
 */
import { create } from 'zustand';
import { tokenStore } from '../lib/apiClient';

const ROLE_LEVEL = {
  super_admin:100, admin:90, manager:70, team_lead:50,
  l2:30, l1:20, employee:10, support:20, finance:20,
  engineering:20, onboarding:20, data:20, verification:20,
};

const PERMISSION_LEVELS = {
  view_mission:10, view_tickets:10, manage_tickets:10, view_hospitals:10, view_patients:10,
  escalate_tickets:20, view_financial:50, manage_employees:50, view_audit:50,
  manage_hospitals:70, send_broadcast:70, manage_iam:90, view_boardroom:90, super_actions:100,
};

const restoreSession = () => {
  try {
    const token = sessionStorage.getItem('matrix_token');
    const user  = JSON.parse(sessionStorage.getItem('hospin_user') || 'null');
    if (token && user) { tokenStore.set(token); return { user, isAuthenticated: true }; }
  } catch (_) {}
  return { user: null, isAuthenticated: false };
};

export const useAuthStore = create((set, get) => ({
  ...restoreSession(),

  login: (user, token) => {
    tokenStore.set(token);
    sessionStorage.setItem('matrix_token', token);
    // Persist must_change_password so ProtectedRoute can intercept on refresh
    const userToStore = { ...user };
    sessionStorage.setItem('hospin_user', JSON.stringify(userToStore));
    set({ user: userToStore, isAuthenticated: true });
  },

  logout: () => {
    tokenStore.clear();
    sessionStorage.removeItem('matrix_token');
    sessionStorage.removeItem('hospin_user');
    // Clear all matrixStore state so next employee doesn't see stale data
    import('./matrixStore').then(({ useMatrixStore }) => {
      useMatrixStore.getState().resetAll();
    });
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (updates) => set((s) => ({ user: s.user ? { ...s.user, ...updates } : null })),

  hasPermission: (action) => {
    const { user } = get();
    if (!user) return false;
    return (ROLE_LEVEL[(user.role||'').toLowerCase()] ?? 10) >= (PERMISSION_LEVELS[action] ?? 100);
  },

  getRoleInfo: () => {
    const { user } = get();
    const role = (user?.role||'').toLowerCase();
    return { role, level: ROLE_LEVEL[role]??10, isAdmin: ROLE_LEVEL[role]>=90, isManager: ROLE_LEVEL[role]>=70, isLead: ROLE_LEVEL[role]>=50 };
  },
}));
