import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, LayoutDashboard, LogOut, ChevronRight } from 'lucide-react';

export default function DashboardRouter() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  // Route to correct dashboard based on JWT role claim (UI convenience only)
  const roleLabel = {
    hospital_admin: 'Hospital Administrator',
    admin: 'Platform Super Admin',
    doctor: 'Doctor',
    nurse: 'Nurse',
    pharmacy: 'Pharmacist',
  }[user?.role] || 'Staff';

  const quickLinks = {
    hospital_admin: [
      { label: 'Setup Hospital', icon: Building2, path: '/setup' },
      { label: 'Manage Staff', icon: Users, path: '/dashboard/admin/staff' },
    ],
    doctor: [
      { label: 'Patient Queue', icon: Users, path: '/dashboard/doctor/queue' },
    ],
    nurse: [
      { label: 'Vitals Queue', icon: LayoutDashboard, path: '/dashboard/nurse/vitals' },
    ],
  }[user?.role] || [];

  return (
    <div style={styles.page}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <div style={styles.logoIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>AHP Portal</span>
        </div>

        <nav style={styles.nav}>
          {quickLinks.map(({ label, icon: Icon, path }) => (
            <button key={path} className="btn btn--ghost" style={styles.navItem} onClick={() => navigate(path)}>
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />
            </button>
          ))}
        </nav>

        <button className="btn btn--ghost btn--sm" style={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={16} /> Sign out
        </button>
      </div>

      <div style={styles.main}>
        <div style={styles.welcomeCard} className="card">
          <span className={`badge badge--${user?.role === 'hospital_admin' ? 'admin' : user?.role || 'doctor'}`} style={{ marginBottom: '1rem' }}>
            {roleLabel}
          </span>
          <h1>Welcome to your Dashboard</h1>
          <p className="text-secondary mt-2">
            Your hospital management tools are being set up. Use the sidebar to navigate.
          </p>
          {user?.role === 'hospital_admin' && !user?.tenantId && (
            <div style={styles.callout}>
              <Building2 size={18} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                  Set up your hospital first
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Complete the 60-second setup wizard to unlock all dashboard features.
                </p>
              </div>
              <button className="btn btn--primary btn--sm" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => navigate('/setup')}>
                Start Setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: '240px', flexShrink: 0,
    background: 'var(--color-bg-surface)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex', flexDirection: 'column',
    padding: '1.5rem 1rem',
  },
  sidebarLogo: {
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    marginBottom: '2rem', padding: '0 0.25rem',
  },
  logoIcon: {
    width: '30px', height: '30px', borderRadius: '8px',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 },
  navItem: { width: '100%', justifyContent: 'flex-start', textAlign: 'left' },
  logoutBtn: { marginTop: 'auto', color: 'var(--color-danger)', borderColor: 'transparent' },
  main: { flex: 1, padding: '2.5rem', overflow: 'auto' },
  welcomeCard: { maxWidth: '640px' },
  callout: {
    display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
    background: 'var(--color-brand-muted)',
    border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    marginTop: '1.5rem',
  },
};
