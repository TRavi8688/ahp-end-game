/**
 * src/components/ProtectedRoute.jsx — Hospain Matrix 3.0
 *
 * CHANGES:
 *  - Intercepts must_change_password flag → redirects to /change-password
 *    (forced on first login with temporary password)
 *  - Uses exact role check via ALLOWED_ROLES Set (BUG-19 FIX: no substring match)
 *  - session stored in sessionStorage only (BUG-23 FIX: no localStorage)
 *  - Optional requiredPermission prop for role-gated routes
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function ProtectedRoute({ children, requiredPermission }) {
  const { isAuthenticated, hasPermission, user } = useAuthStore();
  const location = useLocation();

  // Not logged in → go to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // First-login forced password change — intercept ALL routes except /change-password
  if (
    user?.must_change_password &&
    !location.pathname.startsWith('/change-password')
  ) {
    return (
      <Navigate
        to="/change-password"
        state={{ forced: true, from: location.pathname }}
        replace
      />
    );
  }

  // Role check if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'100%', padding:40, textAlign:'center', background:'#060a12',
      }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
        <h2 style={{ fontSize:18, fontWeight:800, color:'#f1f5f9', margin:'0 0 8px' }}>Access Restricted</h2>
        <p style={{ fontSize:13, color:'#475569', maxWidth:360, lineHeight:1.6 }}>
          Your role (<strong style={{ color:'#818cf8' }}>{user?.role || 'unknown'}</strong>) does not have
          permission to access this module. Contact your manager or Super Admin to request access.
        </p>
        <button
          onClick={() => window.history.back()}
          style={{ marginTop:20, padding:'8px 20px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'none', color:'#94a3b8', fontSize:12, cursor:'pointer' }}
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return children;
}
