/**
 * src/components/ProtectedRoute.jsx — Hospain Matrix 3.0
 *
 * FIXES:
 *  1. Uses authStore.isAuthenticated (survives refresh via sessionStorage)
 *  2. Optional requiredPermission prop for role-gated routes
 *  3. Shows proper "Access Denied" page for insufficient role
 *  4. Hospain branding (not Hospain)
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
          Your role (<strong style={{ color:'#818cf8' }}>{user?.role || 'unknown'}</strong>) does not have permission to access this module.
          Contact your manager or Super Admin to request access.
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
