// super-admin-dashboard/src/components/ProtectedRoute.jsx
// FIXED: Uses react-router-dom Navigate (not window.location).
// Also reads token from in-memory tokenStore (not localStorage).

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function ProtectedRoute({ children, requiredRole }) {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
