/**
 * AHP Staff Portal — Auth Store (Zustand)
 *
 * Single source of truth for authentication state.
 * Persists minimal session info to sessionStorage.
 * Parses JWT claims (tenant_id, role) without trusting them for authorization —
 * they are used for UI routing convenience ONLY.
 */
import { create } from 'zustand';

/** Safely decode a JWT payload without verification (UI only). */
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export const useAuthStore = create((set, get) => ({
  token: sessionStorage.getItem('ahp_access_token') || null,
  user: (() => {
    try { return JSON.parse(sessionStorage.getItem('ahp_user')); } catch { return null; }
  })(),

  /** Called after successful login API response. */
  setAuth: (accessToken) => {
    const claims = decodeJwtPayload(accessToken);
    const user = {
      id: claims?.sub,
      role: claims?.role,
      tenantId: claims?.tenant_id,
      deptScope: claims?.dept_scope || [],
      tokenVersion: claims?.token_version,
    };
    sessionStorage.setItem('ahp_access_token', accessToken);
    sessionStorage.setItem('ahp_user', JSON.stringify(user));
    set({ token: accessToken, user });
  },

  logout: () => {
    sessionStorage.removeItem('ahp_access_token');
    sessionStorage.removeItem('ahp_user');
    set({ token: null, user: null });
  },

  /** Convenience: is the user's role in the allowed list? */
  hasRole: (...roles) => roles.includes(get().user?.role),

  isAuthenticated: () => !!get().token,
}));
