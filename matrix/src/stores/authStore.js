/**
 * src/stores/authStore.js — Hospin Matrix 3.0
 *
 * FIXES:
 *  1. Token stored in-memory (tokenStore) — no PHI in localStorage
 *  2. Also persists to sessionStorage so page refresh keeps login
 *     (sessionStorage clears on tab close — secure enough for internal portal)
 *  3. Role hierarchy: super_admin > manager > team_lead > l1/l2
 *  4. hasPermission(action) helper for role-based UI gating
 *  5. isAuthenticated survives page refresh via sessionStorage
 */
import { create } from 'zustand';
import { tokenStore } from '../lib/apiClient';

// Role hierarchy levels (higher = more access)
const ROLE_LEVEL = {
  super_admin: 100,
  admin:       90,
  manager:     70,
  team_lead:   50,
  l2:          30,
  l1:          20,
  employee:    10,
  support:     20,
  finance:     20,
  engineering: 20,
  onboarding:  20,
  data:        20,
  verification:20,
};

// What each permission requires as MINIMUM role level
const PERMISSION_LEVELS = {
  view_mission:        10,   // all employees
  view_tickets:        10,
  manage_tickets:      10,
  view_hospitals:      10,
  view_patients:       10,
  escalate_tickets:    20,
  view_financial:      50,   // team lead and above
  manage_employees:    50,
  view_audit:          50,
  manage_hospitals:    70,   // manager and above
  send_broadcast:      70,
  manage_iam:          90,   // admin and above
  view_boardroom:      90,
  super_actions:       100,  // super admin only
};

// Restore session from sessionStorage on page load
const restoreSession = () => {
  try {
    const token = sessionStorage.getItem('hospin_token');
    const user  = JSON.parse(sessionStorage.getItem('hospin_user') || 'null');
    if (token && user) {
      tokenStore.set(token);
      return { user, isAuthenticated: true };
    }
  } catch (_) {}
  return { user: null, isAuthenticated: false };
};

export const useAuthStore = create((set, get) => ({
  ...restoreSession(),

  login: (user, token) => {
    tokenStore.set(token);
    // sessionStorage: survives refresh, clears on tab close
    sessionStorage.setItem('hospin_token', token);
    sessionStorage.setItem('hospin_user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    tokenStore.clear();
    sessionStorage.removeItem('hospin_token');
    sessionStorage.removeItem('hospin_user');
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (updates) =>
    set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

  // Check if current user has a specific permission
  hasPermission: (action) => {
    const { user } = get();
    if (!user) return false;
    const role      = (user.role || '').toLowerCase();
    const userLevel = ROLE_LEVEL[role] ?? 10;
    const required  = PERMISSION_LEVELS[action] ?? 100;
    return userLevel >= required;
  },

  // Get role display info
  getRoleInfo: () => {
    const { user } = get();
    const role = (user?.role || '').toLowerCase();
    return {
      role,
      level:     ROLE_LEVEL[role] ?? 10,
      isAdmin:   ROLE_LEVEL[role] >= 90,
      isManager: ROLE_LEVEL[role] >= 70,
      isLead:    ROLE_LEVEL[role] >= 50,
    };
  },
}));
