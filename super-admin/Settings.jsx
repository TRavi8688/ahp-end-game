import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import useAuthStore from '../store/authStore';

function Section({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '0.875rem',
      padding: '1.5rem',
      marginBottom: '1.25rem',
    }}>
      <h3 style={{
        margin: '0 0 1.25rem',
        fontSize: '0.8rem', fontWeight: '700', color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>{title}</h3>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.5rem',
  color: '#f1f5f9',
  padding: '0.6rem 0.875rem',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  color: '#94a3b8',
  marginBottom: '0.35rem',
  fontWeight: '500',
};

function Toggle({ checked, onChange, label, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '0.875rem', fontWeight: '500' }}>{label}</div>
        {description && <div style={{ color: '#475569', fontSize: '0.78rem', marginTop: '2px' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: '44px', height: '24px', borderRadius: '12px',
          background: checked ? 'linear-gradient(135deg, #0ea5e9, #6366f1)' : 'rgba(255,255,255,0.1)',
          border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: '3px',
          left: checked ? '23px' : '3px',
          width: '18px', height: '18px', borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
          display: 'block',
        }} />
      </button>
    </div>
  );
}

export default function Settings() {
  const { user }     = useAuthStore();
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState(null);

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [notifications, setNotifications] = useState({
    email_alerts:        true,
    sms_alerts:          false,
    push_alerts:         true,
    critical_only:       false,
    weekly_report:       true,
    verification_updates:true,
  });

  const [system, setSystem] = useState({
    session_timeout_minutes: 30,
    require_2fa:            true,
    audit_retention_days:   365,
    api_rate_limit:         1000,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get('/api/v1/admin/settings');
        if (res.data?.profile)       setProfile(p => ({ ...p, ...res.data.profile }));
        if (res.data?.notifications) setNotifications(n => ({ ...n, ...res.data.notifications }));
        if (res.data?.system)        setSystem(s => ({ ...s, ...res.data.system }));
      } catch {
        // non-fatal — defaults remain
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch('/api/v1/admin/settings', { profile, notifications, system });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f1f5f9', margin: 0, letterSpacing: '-0.5px' }}>
          Settings
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.9rem' }}>
          Manage your account, notification preferences, and system configuration
        </p>
      </div>

      {/* Profile */}
      <Section title="Profile">
        <div style={grid2}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input style={inputStyle} value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input style={inputStyle} type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={labelStyle}>Phone Number</label>
          <input style={{ ...inputStyle, maxWidth: '280px' }} value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+91 …" />
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notification Preferences">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Toggle
            checked={notifications.email_alerts}
            onChange={v => setNotifications(n => ({ ...n, email_alerts: v }))}
            label="Email Alerts"
            description="Receive alerts and digests by email"
          />
          <Toggle
            checked={notifications.sms_alerts}
            onChange={v => setNotifications(n => ({ ...n, sms_alerts: v }))}
            label="SMS Alerts"
            description="Critical alerts via SMS"
          />
          <Toggle
            checked={notifications.push_alerts}
            onChange={v => setNotifications(n => ({ ...n, push_alerts: v }))}
            label="Push Notifications"
            description="Browser push for real-time events"
          />
          <Toggle
            checked={notifications.critical_only}
            onChange={v => setNotifications(n => ({ ...n, critical_only: v }))}
            label="Critical Alerts Only"
            description="Suppress low-severity notifications"
          />
          <Toggle
            checked={notifications.weekly_report}
            onChange={v => setNotifications(n => ({ ...n, weekly_report: v }))}
            label="Weekly Summary Report"
            description="Emailed every Monday morning"
          />
          <Toggle
            checked={notifications.verification_updates}
            onChange={v => setNotifications(n => ({ ...n, verification_updates: v }))}
            label="Verification Queue Updates"
            description="Notify on new hospital verification requests"
          />
        </div>
      </Section>

      {/* System */}
      <Section title="System Configuration">
        <div style={grid2}>
          <div>
            <label style={labelStyle}>Session Timeout (minutes)</label>
            <input style={inputStyle} type="number" min="5" max="480"
              value={system.session_timeout_minutes}
              onChange={e => setSystem(s => ({ ...s, session_timeout_minutes: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Audit Log Retention (days)</label>
            <input style={inputStyle} type="number" min="30" max="3650"
              value={system.audit_retention_days}
              onChange={e => setSystem(s => ({ ...s, audit_retention_days: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Toggle
            checked={system.require_2fa}
            onChange={v => setSystem(s => ({ ...s, require_2fa: v }))}
            label="Require Two-Factor Authentication"
            description="Enforce 2FA for all super admin logins"
          />
        </div>
      </Section>

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            color: '#fff', border: 'none',
            padding: '0.7rem 2rem',
            borderRadius: '0.6rem',
            fontWeight: '700', fontSize: '0.9rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: '600' }}>✓ Saved!</span>}
        {error && <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</span>}
      </div>
    </div>
  );
}
