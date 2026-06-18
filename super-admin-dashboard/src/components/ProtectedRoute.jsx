import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * ProtectedRoute
 * Redirects unauthenticated users to /login.
 * Redirects users without the required role to /unauthorized.
 *
 * @param {React.ReactNode} children
 * @param {string} requiredRole  — default 'super_admin'
 */
export function ProtectedRoute({ children, requiredRole = 'super_admin' }) {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (requiredRole && user?.role !== requiredRole) {
      navigate('/unauthorized', { replace: true });
    }
  }, [isAuthenticated, user, navigate, requiredRole]);

  if (!isAuthenticated) return null;
  return children;
}
