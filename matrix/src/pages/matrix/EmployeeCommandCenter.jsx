/**
 * src/pages/matrix/EmployeeCommandCenter.jsx — Hospain Matrix 3.0
 *
 * MODULE 5-7: Employee Command Center
 *
 * THIS IS THE ANSWER TO YOUR QUESTION:
 * "How to give logins to employees and manage their credentials and levels?"
 *
 * This page lets Super Admin / Manager:
 *   1. CREATE employee accounts (sets email + password → they get portal access)
 *   2. SET their ROLE / LEVEL (l1, l2, team_lead, manager, super_admin)
 *   3. SET their TEAM (support, finance, engineering, etc.)
 *   4. RESET their password
 *   5. SUSPEND / REACTIVATE accounts
 *   6. See live workload per employee
 *   7. Change shift status → auto-redistributes tickets
 *
 * HOW LOGIN WORKS FOR EMPLOYEES:
 *   → Super Admin creates employee here (fills name, email, team, role, temp password)
 *   → Employee uses that email + password at /login
 *   → System checks their role and grants access to appropriate modules
 *   → Super Admin can reset password or suspend anytime from this page
 */
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/apiClient';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:'#060a12', surface:'#0c1220', border:'rgba(255,255,255,0.06)',
  indigo:'#6366f1', indigoL:'#818cf8', emerald:'#10b981', amber:'#f59e0b',
  rose:'#f43f5e', cyan:'#06b6d4', violet:'#8b5cf6', slate:'#475569',
  text:'#f1f5f9', textMid:'#94a3b8', textDim:'#475569',
};

const SHIFT_COLOR = {
  online:'#10b981', offline:'#475569', break:'#f59e0b',
  meeting:'#06b6d4', training:'#8b5cf6', leave:'#f43f5e',
};

// ─── Role definitions with descriptions ──────────────────────────────────────
const ROLES = [
  { value:'super_admin', label:'Super Admin',      level:100, desc:'Full system access. Can create/delete employees, change any role, access all modules.' },
  { value:'admin',       label:'Admin',            level:90,  desc:'Full access except deleting super admins.' },
  { value:'manager',     label:'Operations Manager',level:70, desc:'Manages teams, views financials, sends broadcasts, approves verifications.' },
  { value:'team_lead',   label:'Team Lead',        level:50,  desc:'Manages team queue, reassigns tickets, views team performance and SLA risk.' },
  { value:'l2',          label:'L2 Agent',         level:30,  desc:'Handles escalated tickets, investigates complex issues, accesses system logs.' },
  { value:'l1',          label:'L1 Agent',         level:20,  desc:'Handles standard tickets, replies to customers, resolves basic issues.' },
];

const TEAMS = ['support','finance','engineering','onboarding','data','verification','compliance'];
const SHIFTS = ['online','offline','break','meeting','training','leave'];

// ─── Tiny UI components ───────────────────────────────────────────────────────
const Badge = ({ label, color }) => (
  <span style={{ background:`${color}18`, color, border:`1px solid ${color}30`, padding:'2px 8px', borderRadius:20, fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{label}</span>
);

const Btn = ({ children, color=T.indigo, onClick, disabled, small, outline }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? '4px 10px' : '8px 16px',
    borderRadius:8, border:`1px solid ${color}40`,
    background: outline ? 'transparent' : `${color}18`,
    color, fontSize: small ? 10 : 12, fontWeight:700, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, transition:'all 0.12s', whiteSpace:'nowrap',
  }}
    onMouseEnter={e => { if(!disabled) e.currentTarget.style.background=`${color}28`; }}
    onMouseLeave={e => { e.currentTarget.style.background=outline?'transparent':`${color}18`; }}
  >{children}</button>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:'block', fontSize:11, color:T.textDim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5 }}>{label}</label>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, type='text', readOnly }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${T.border}`, background: readOnly ? 'rgba(255,255,255,0.02)' : T.bg, color:T.text, fontSize:12, outline:'none', boxSizing:'border-box', cursor: readOnly ? 'default' : 'text' }}
    onFocus={e => { if(!readOnly) e.target.style.borderColor=T.indigo; }}
    onBlur={e  => { e.target.style.borderColor=T.border; }}
  />
);

const Select = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange}
    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.textMid, fontSize:12, outline:'none', boxSizing:'border-box' }}>
    {children}
  </select>
);

const ProgressBar = ({ value, max, color }) => (
  <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:4, height:4, overflow:'hidden' }}>
    <div style={{ width:`${Math.min(100,(value/max)*100)}%`, height:'100%', background:color||T.indigo, borderRadius:4, transition:'width 0.4s' }} />
  </div>
);

// ─── Create Employee Modal ────────────────────────────────────────────────────
function CreateEmployeeModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    full_name:'', email:'', phone:'', role:'l1', team:'support',
    temp_password:'', employee_id:'',
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.temp_password) {
      setError('Name, email and temporary password are required.'); return;
    }
    setSaving(true); setError('');
    try {
      const res = await api.post('/api/v1/matrix/employees/create', {
        full_name:    form.full_name,
        email:        form.email.toLowerCase(),
        phone:        form.phone || undefined,
        role:         form.role,
        team:         form.team,
        password:     form.temp_password,
        employee_id:  form.employee_id || undefined,
      });
      setSuccess(`✓ Employee created! They can now log in at /login with email: ${form.email} and the temporary password you set.`);
      setTimeout(() => { onCreated?.(); onClose(); }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to create employee. Check backend connection.');
    } finally {
      setSaving(false);
    }
  };

  const roleInfo = ROLES.find(r => r.value === form.role);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:28, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <div>
            <h2 style={{ fontSize:16, fontWeight:800, color:T.text, margin:0 }}>Create Employee Account</h2>
            <p style={{ fontSize:11, color:T.textDim, margin:'3px 0 0' }}>Employee receives login credentials for Hospain Matrix</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:22 }}>×</button>
        </div>

        {/* How login works — explanation box */}
        <div style={{ background:`${T.indigo}08`, border:`1px solid ${T.indigo}20`, borderRadius:10, padding:'12px 14px', marginBottom:20 }}>
          <div style={{ fontSize:11, color:T.indigoL, fontWeight:700, marginBottom:5 }}>🔑 How employee login works</div>
          <ol style={{ margin:0, padding:'0 0 0 16px', fontSize:11, color:T.textMid, lineHeight:1.8 }}>
            <li>Fill this form → set their email + temporary password</li>
            <li>Share those credentials with the employee</li>
            <li>Employee opens <code style={{ color:T.indigoL }}>/login</code> and enters their email + password</li>
            <li>System checks their role → grants access to appropriate modules</li>
            <li>Employee should change their password after first login</li>
          </ol>
        </div>

        {error   && <div style={{ padding:'10px 14px', background:`${T.rose}10`, border:`1px solid ${T.rose}20`, borderRadius:8, marginBottom:14, fontSize:12, color:T.rose }}>{error}</div>}
        {success && <div style={{ padding:'10px 14px', background:`${T.emerald}10`, border:`1px solid ${T.emerald}20`, borderRadius:8, marginBottom:14, fontSize:12, color:T.emerald }}>{success}</div>}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <Field label="Full Name *">
              <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Priya Krishnan" />
            </Field>
          </div>
          <Field label="Work Email *">
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="priya@hospain.in" />
          </Field>
          <Field label="Employee ID (optional)">
            <Input value={form.employee_id} onChange={e => set('employee_id', e.target.value)} placeholder="HPN-SUP-L1-001 (auto if blank)" />
          </Field>
          <Field label="Phone (optional)">
            <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Team *">
            <Select value={form.team} onChange={e => set('team', e.target.value)}>
              {TEAMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </Select>
          </Field>
          <div style={{ gridColumn:'1/-1' }}>
            <Field label="Role / Access Level *">
              <Select value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} (Level {r.level})</option>)}
              </Select>
              {roleInfo && (
                <div style={{ marginTop:6, padding:'8px 10px', background:'rgba(255,255,255,0.02)', borderRadius:7, fontSize:11, color:T.textDim, lineHeight:1.5 }}>
                  🔐 <strong style={{ color:T.textMid }}>{roleInfo.label}:</strong> {roleInfo.desc}
                </div>
              )}
            </Field>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <Field label="Temporary Password *">
              <Input type="password" value={form.temp_password} onChange={e => set('temp_password', e.target.value)} placeholder="Min 8 characters — employee changes this on first login" />
            </Field>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:6 }}>
          <Btn color={T.slate} onClick={onClose} outline>Cancel</Btn>
          <Btn color={T.indigo} onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating Account…' : '→ Create Employee Account'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Change Role Modal ────────────────────────────────────────────────────────
function ChangeRoleModal({ employee, onClose, onSaved }) {
  const [role, setRole] = useState(employee.role || 'l1');
  const [team, setTeam] = useState(employee.team || 'support');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await api.patch(`/api/v1/matrix/employees/${employee.employee_id}/role`, { role, team });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update role.');
    } finally {
      setSaving(false);
    }
  };

  const roleInfo = ROLES.find(r => r.value === role);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:24, width:'100%', maxWidth:420 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:T.text, margin:0 }}>Change Role — {employee.full_name}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        {error && <div style={{ padding:'10px', background:`${T.rose}10`, borderRadius:8, marginBottom:12, fontSize:12, color:T.rose }}>{error}</div>}
        <Field label="New Role">
          <Select value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          {roleInfo && <div style={{ marginTop:6, fontSize:11, color:T.textDim, lineHeight:1.5 }}>{roleInfo.desc}</div>}
        </Field>
        <Field label="Team">
          <Select value={team} onChange={e => setTeam(e.target.value)}>
            {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
          <Btn color={T.slate} onClick={onClose} outline>Cancel</Btn>
          <Btn color={T.violet} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Role'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function ResetPasswordModal({ employee, onClose }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/api/v1/matrix/employees/${employee.employee_id}/reset-password`, { new_password: password });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:24, width:'100%', maxWidth:380 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:T.text, margin:0 }}>Reset Password</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <p style={{ fontSize:12, color:T.textMid, marginBottom:16 }}>
          Resetting password for <strong style={{ color:T.text }}>{employee.full_name}</strong> ({employee.email}).<br/>
          Share the new password with the employee securely.
        </p>
        {error && <div style={{ padding:'10px', background:`${T.rose}10`, borderRadius:8, marginBottom:12, fontSize:12, color:T.rose }}>{error}</div>}
        {done
          ? <div style={{ padding:'12px 14px', background:`${T.emerald}10`, border:`1px solid ${T.emerald}20`, borderRadius:8, fontSize:12, color:T.emerald, marginBottom:16 }}>
              ✓ Password reset successfully. Share the new password with {employee.full_name}.
            </div>
          : <Field label="New Password">
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
            </Field>
        }
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn color={T.slate} onClick={onClose} outline>Close</Btn>
          {!done && <Btn color={T.amber} onClick={handleReset} disabled={saving}>{saving ? 'Resetting…' : 'Reset Password'}</Btn>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmployeeCommandCenter() {
  const { hasPermission, user } = useAuthStore();

  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [view, setView] = useState('grid'); // grid | table | workload
  const [selected, setSelected] = useState(null);

  // Modals
  const [showCreate,    setShowCreate]    = useState(false);
  const [changeRole,    setChangeRole]    = useState(null);  // employee obj
  const [resetPwd,      setResetPwd]      = useState(null);  // employee obj
  const [confirmAction, setConfirmAction] = useState(null);  // {employee, action}

  const canManage = hasPermission('manage_employees');

  const fetchEmployees = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = teamFilter ? `?team=${teamFilter}` : '';
      const data = await api.get(`/api/v1/matrix/employees${params}`);
      setEmployees(data?.data?.employees || data?.employees || []);
    } catch (err) {
      setError(err.message);
      // Demo fallback so UI shows even without backend
      setEmployees([
        { employee_id:'HPN-SUP-L1-001', full_name:'Priya Krishnan', email:'priya@hospain.in', team:'support', role:'l1', shift_status:'online', open_tickets:12, daily_ticket_limit:40, resolved_total:847, is_active:true },
        { employee_id:'HPN-SUP-MGR-001', full_name:'Vikram Nair', email:'vikram@hospain.in', team:'support', role:'manager', shift_status:'meeting', open_tickets:5, daily_ticket_limit:40, resolved_total:3821, is_active:true },
        { employee_id:'HPN-ENG-TL-001', full_name:'Suresh Patel', email:'suresh@hospain.in', team:'engineering', role:'team_lead', shift_status:'online', open_tickets:18, daily_ticket_limit:40, resolved_total:2147, is_active:true },
        { employee_id:'HPN-FIN-L1-001', full_name:'Anjali Mehta', email:'anjali@hospain.in', team:'finance', role:'l1', shift_status:'break', open_tickets:6, daily_ticket_limit:40, resolved_total:531, is_active:true },
        { employee_id:'HPN-ONB-L1-001', full_name:'Kavya Reddy', email:'kavya@hospain.in', team:'onboarding', role:'l1', shift_status:'leave', open_tickets:0, daily_ticket_limit:40, resolved_total:389, is_active:false },
      ]);
    } finally {
      setLoading(false);
    }
  }, [teamFilter]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleShiftChange = async (employee, newShift) => {
    try {
      await api.patch(`/api/v1/matrix/employees/${employee.employee_id}/shift`, { shift_status: newShift });
      fetchEmployees();
    } catch (err) {
      alert('Shift update failed: ' + err.message);
    }
  };

  const handleSuspend = async (employee, suspend) => {
    try {
      await api.post(`/api/v1/matrix/iam/employee/${employee.employee_id}/action`, {
        action: suspend ? 'suspend' : 'activate',
        reason: suspend ? 'Suspended via Employee Command Center' : 'Reactivated',
      });
      fetchEmployees();
    } catch (err) {
      alert('Action failed: ' + err.message);
    } finally {
      setConfirmAction(null);
    }
  };

  const byStatus = s => employees.filter(e => e.shift_status === s).length;

  return (
    <div style={{ padding:'22px 24px', overflowY:'auto', height:'100%', boxSizing:'border-box' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:19, fontWeight:900, color:T.text, margin:0, letterSpacing:'-0.02em' }}>Employee Command Center</h1>
          <p style={{ fontSize:12, color:T.textDim, margin:'4px 0 0' }}>
            Manage employee accounts, roles, credentials, shifts, and workload
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} style={{ padding:'8px 16px', borderRadius:9, border:`1px solid ${T.indigo}40`, background:`${T.indigo}18`, color:T.indigoL, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            + Create Employee Account
          </button>
        )}
      </div>

      {/* How credentials work — always visible info box */}
      <div style={{ background:`${T.cyan}06`, border:`1px solid ${T.cyan}15`, borderRadius:12, padding:'14px 16px', marginBottom:18 }}>
        <div style={{ fontSize:11, color:T.cyan, fontWeight:700, marginBottom:8 }}>
          🔑 How Employee Logins &amp; Credentials Work
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>
          {[
            { step:'1. Create Account', desc:'Super Admin / Manager fills the form above with name, email, role and sets a temporary password.' },
            { step:'2. Share Credentials', desc:'Share email + temp password with the employee securely (WhatsApp, encrypted email, etc.).' },
            { step:'3. Employee Logs In', desc:'Employee opens hospain.in/login → enters email + password → gets access based on their role.' },
            { step:'4. Role Controls Access', desc:'L1 sees tickets only. Manager sees financials. Super Admin sees everything. Role is set here.' },
          ].map(({ step, desc }) => (
            <div key={step} style={{ fontSize:11, color:T.textMid, lineHeight:1.6 }}>
              <div style={{ color:T.cyan, fontWeight:700, marginBottom:2 }}>{step}</div>
              {desc}
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:18 }}>
        {[
          ['Total', employees.length, T.indigo],
          ['Online', byStatus('online'), T.emerald],
          ['Break', byStatus('break'), T.amber],
          ['Meeting', byStatus('meeting'), T.cyan],
          ['Training', byStatus('training'), T.violet],
          ['Leave', byStatus('leave'), T.rose],
        ].map(([l,v,c]) => (
          <div key={l} style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`3px solid ${c}`, borderRadius:11, padding:'12px 14px' }}>
            <div style={{ fontSize:9, color:T.textDim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:20, fontWeight:800, color:T.text }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
        {['', ...TEAMS].map(t => (
          <button key={t} onClick={() => setTeamFilter(t)} style={{
            padding:'4px 12px', borderRadius:16,
            border:`1px solid ${teamFilter===t?T.indigo:T.border}`,
            background: teamFilter===t?`${T.indigo}18`:'none',
            color: teamFilter===t?T.indigoL:T.textDim,
            fontSize:11, cursor:'pointer', textTransform:'capitalize',
          }}>{t || 'All Teams'}</button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {['grid','table','workload'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:'4px 10px', borderRadius:6,
              border:`1px solid ${view===v?T.indigo:T.border}`,
              background: view===v?`${T.indigo}18`:'none',
              color: view===v?T.indigoL:T.textDim,
              fontSize:11, cursor:'pointer',
            }}>{v}</button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding:'10px 14px', background:`${T.amber}08`, border:`1px solid ${T.amber}20`, borderRadius:9, marginBottom:14, fontSize:11, color:T.amber }}>
          ⚠ Backend offline — showing demo data. {error}
        </div>
      )}

      {/* Grid view */}
      {!loading && view === 'grid' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:10 }}>
          {employees.map(e => {
            const sc  = SHIFT_COLOR[e.shift_status] || T.slate;
            const pct = ((e.open_tickets||0)/(e.daily_ticket_limit||40))*100;
            const roleInfo = ROLES.find(r => r.value === e.role);
            return (
              <div key={e.employee_id} onClick={() => setSelected(selected?.employee_id===e.employee_id?null:e)} style={{
                background: selected?.employee_id===e.employee_id?'rgba(99,102,241,0.08)':T.surface,
                border:`1px solid ${selected?.employee_id===e.employee_id?`${T.indigo}40`:T.border}`,
                borderRadius:12, padding:14, cursor:'pointer', transition:'all 0.15s',
                opacity: e.is_active===false ? 0.5 : 1,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:`${sc}18`, border:`1px solid ${sc}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:sc }}>
                    {(e.avatar_initials || e.full_name?.slice(0,2) || '??').toUpperCase()}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:sc, boxShadow:e.shift_status==='online'?`0 0 5px ${sc}`:'none' }} />
                    {e.is_active===false && <span style={{ fontSize:8, color:T.rose, fontWeight:700 }}>SUSPENDED</span>}
                  </div>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:2 }}>{e.full_name}</div>
                <div style={{ fontSize:10, color:T.textDim, marginBottom:6 }}>{e.email}</div>
                <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
                  <Badge label={e.role || 'l1'} color={T.violet} />
                  <Badge label={e.team} color={T.cyan} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:10, color:T.textMid }}>{e.open_tickets||0} / {e.daily_ticket_limit||40} tickets</span>
                  <span style={{ fontSize:9, color:pct>80?T.rose:T.textDim }}>{Math.round(pct)}%</span>
                </div>
                <ProgressBar value={e.open_tickets||0} max={e.daily_ticket_limit||40} color={pct>80?T.rose:pct>50?T.amber:T.emerald} />
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {!loading && view === 'table' && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Name','Email','Employee ID','Team','Role','Shift','Open','Status','Actions'].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', borderBottom:`1px solid ${T.border}`, fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:T.textDim, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((e,i) => (
                <tr key={e.employee_id} style={{ borderBottom:i<employees.length-1?`1px solid ${T.border}`:'none' }}
                  onMouseEnter={el => el.currentTarget.style.background='rgba(255,255,255,0.02)'}
                  onMouseLeave={el => el.currentTarget.style.background='transparent'}
                >
                  <td style={{ padding:'9px 12px', color:T.text, fontWeight:500 }}>{e.full_name}</td>
                  <td style={{ padding:'9px 12px', color:T.textDim, fontSize:11 }}>{e.email}</td>
                  <td style={{ padding:'9px 12px', color:T.textDim, fontSize:10, fontFamily:'monospace' }}>{e.employee_id}</td>
                  <td style={{ padding:'9px 12px' }}><Badge label={e.team} color={T.cyan} /></td>
                  <td style={{ padding:'9px 12px' }}><Badge label={e.role||'l1'} color={T.violet} /></td>
                  <td style={{ padding:'9px 12px' }}><Badge label={e.shift_status||'offline'} color={SHIFT_COLOR[e.shift_status]||T.slate} /></td>
                  <td style={{ padding:'9px 12px', color:T.text, fontWeight:700 }}>{e.open_tickets||0}</td>
                  <td style={{ padding:'9px 12px' }}><Badge label={e.is_active===false?'suspended':'active'} color={e.is_active===false?T.rose:T.emerald} /></td>
                  <td style={{ padding:'9px 12px' }}>
                    {canManage && (
                      <div style={{ display:'flex', gap:4 }}>
                        <Btn small color={T.violet} onClick={() => setChangeRole(e)}>Role</Btn>
                        <Btn small color={T.amber}  onClick={() => setResetPwd(e)}>PWD</Btn>
                        {e.is_active!==false
                          ? <Btn small color={T.rose}    onClick={() => setConfirmAction({employee:e,action:'suspend'})}>Suspend</Btn>
                          : <Btn small color={T.emerald} onClick={() => setConfirmAction({employee:e,action:'activate'})}>Activate</Btn>
                        }
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Workload view */}
      {!loading && view === 'workload' && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
          <div style={{ fontSize:11, color:T.textDim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>
            Live Workload — Auto-Balance Engine assigns new tickets to lowest-load agent
          </div>
          {[...employees].filter(e=>e.shift_status!=='leave'&&e.shift_status!=='offline').sort((a,b)=>(b.open_tickets||0)-(a.open_tickets||0)).map(e => {
            const load = e.open_tickets||0;
            const cap  = e.daily_ticket_limit||40;
            const pct  = (load/cap)*100;
            const c    = pct>80?T.rose:pct>50?T.amber:T.emerald;
            const sc   = SHIFT_COLOR[e.shift_status]||T.slate;
            const isNext = load === Math.min(...employees.filter(x=>x.shift_status==='online').map(x=>x.open_tickets||0));
            return (
              <div key={e.employee_id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, padding:'8px 10px', borderRadius:8, background:isNext?`${T.emerald}05`:'transparent', border:`1px solid ${isNext?`${T.emerald}20`:'transparent'}` }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:`${sc}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:sc, flexShrink:0 }}>
                  {(e.avatar_initials||e.full_name?.slice(0,2)||'?').toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, color:T.text, fontWeight:500 }}>{e.full_name} <span style={{ fontSize:10, color:T.textDim }}>({e.team} · {e.role})</span></span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {isNext && <span style={{ fontSize:9, color:T.emerald, background:`${T.emerald}15`, padding:'1px 7px', borderRadius:10, fontWeight:700 }}>NEXT IN QUEUE</span>}
                      <span style={{ fontSize:13, fontWeight:700, color:c }}>{load}</span>
                      <span style={{ fontSize:10, color:T.textDim }}>/ {cap}</span>
                    </div>
                  </div>
                  <ProgressBar value={load} max={cap} color={c} />
                </div>
                {canManage && (
                  <select value={e.shift_status} onChange={ev => handleShiftChange(e, ev.target.value)}
                    style={{ padding:'4px 6px', borderRadius:6, border:`1px solid ${T.border}`, background:T.bg, color:sc, fontSize:10, cursor:'pointer' }}>
                    {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selected employee detail panel */}
      {selected && (
        <div style={{ marginTop:14, background:T.surface, border:`1px solid ${T.indigo}30`, borderRadius:14, padding:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ width:46, height:46, borderRadius:'50%', background:`${SHIFT_COLOR[selected.shift_status]||T.indigo}18`, border:`2px solid ${SHIFT_COLOR[selected.shift_status]||T.indigo}50`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:SHIFT_COLOR[selected.shift_status]||T.indigo }}>
                {(selected.avatar_initials||selected.full_name?.slice(0,2)||'?').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:T.text }}>{selected.full_name}</div>
                <div style={{ fontSize:11, color:T.textDim }}>{selected.employee_id} · {selected.email}</div>
                <div style={{ display:'flex', gap:6, marginTop:4 }}>
                  <Badge label={selected.role||'l1'} color={T.violet} />
                  <Badge label={selected.team} color={T.cyan} />
                  <Badge label={selected.shift_status} color={SHIFT_COLOR[selected.shift_status]||T.slate} />
                </div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:20 }}>×</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
            {[['Open Tickets',selected.open_tickets||0],['Resolved Total',(selected.resolved_total||0).toLocaleString()],['Daily Limit',selected.daily_ticket_limit||40],['Account',selected.is_active===false?'Suspended':'Active']].map(([k,v]) => (
              <div key={k} style={{ background:'rgba(255,255,255,0.02)', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:9, color:T.textDim, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em' }}>{k}</div>
                <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{v}</div>
              </div>
            ))}
          </div>
          {canManage && (
            <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
              <Btn color={T.violet}  onClick={() => setChangeRole(selected)}>Change Role</Btn>
              <Btn color={T.amber}   onClick={() => setResetPwd(selected)}>Reset Password</Btn>
              {SHIFTS.map(s => (
                <Btn key={s} small color={SHIFT_COLOR[s]||T.slate} onClick={() => handleShiftChange(selected, s)} outline={s!==selected.shift_status}>
                  {s===selected.shift_status?`● ${s}`:`→ ${s}`}
                </Btn>
              ))}
              {selected.is_active!==false
                ? <Btn color={T.rose} onClick={() => setConfirmAction({employee:selected,action:'suspend'})}>Suspend Account</Btn>
                : <Btn color={T.emerald} onClick={() => setConfirmAction({employee:selected,action:'activate'})}>Reactivate Account</Btn>
              }
            </div>
          )}
          {!canManage && (
            <div style={{ fontSize:11, color:T.textDim, padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:8 }}>
              You need Manager or higher role to manage employee accounts.
            </div>
          )}
        </div>
      )}

      {/* Role hierarchy reference */}
      <div style={{ marginTop:18, background:`${T.violet}06`, border:`1px solid ${T.violet}15`, borderRadius:12, padding:14 }}>
        <div style={{ fontSize:11, color:T.violet, fontWeight:700, marginBottom:10 }}>📊 Role Hierarchy &amp; Access Levels</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8 }}>
          {ROLES.map(r => (
            <div key={r.value} style={{ padding:'8px 10px', background:'rgba(255,255,255,0.02)', borderRadius:8, borderLeft:`2px solid ${T.violet}40` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:11, fontWeight:700, color:T.text }}>{r.label}</span>
                <span style={{ fontSize:9, color:T.violet, fontWeight:700 }}>Level {r.level}</span>
              </div>
              <div style={{ fontSize:10, color:T.textDim, lineHeight:1.5 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showCreate    && <CreateEmployeeModal onClose={() => setShowCreate(false)} onCreated={fetchEmployees} />}
      {changeRole    && <ChangeRoleModal employee={changeRole} onClose={() => setChangeRole(null)} onSaved={fetchEmployees} />}
      {resetPwd      && <ResetPasswordModal employee={resetPwd} onClose={() => setResetPwd(null)} />}

      {/* Confirm suspend/activate */}
      {confirmAction && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:24, width:380 }}>
            <h3 style={{ fontSize:14, fontWeight:800, color:T.text, marginBottom:10 }}>
              Confirm: {confirmAction.action === 'suspend' ? 'Suspend' : 'Reactivate'} Account
            </h3>
            <p style={{ fontSize:12, color:T.textMid, marginBottom:20 }}>
              {confirmAction.action === 'suspend'
                ? `Suspending ${confirmAction.employee.full_name} will immediately block their login and remove them from the ticket assignment pool.`
                : `Reactivating ${confirmAction.employee.full_name} will restore their login access and allow ticket assignment.`}
            </p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <Btn color={T.slate} onClick={() => setConfirmAction(null)} outline>Cancel</Btn>
              <Btn color={confirmAction.action==='suspend'?T.rose:T.emerald} onClick={() => handleSuspend(confirmAction.employee, confirmAction.action==='suspend')}>
                Confirm {confirmAction.action === 'suspend' ? 'Suspend' : 'Reactivate'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
