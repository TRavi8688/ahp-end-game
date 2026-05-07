/**
 * AHP Staff Portal — Protected Route Guard
 *
 * Wraps all authenticated routes. Checks auth state from the store.
 * If unauthenticated, redirects to /login immediately.
 * Does NOT trust JWT claims for authorization — that is the backend's job.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/**
 * Role Gate — renders children only if user has one of the required roles.
 * For UI display gating ONLY. Backend enforces all real permissions.
 */
export function RoleGate({ roles, fallback = null, children }) {
  const hasRole = useAuthStore((s) => s.hasRole);
  if (!hasRole(...roles)) return fallback;
  return children;
}
