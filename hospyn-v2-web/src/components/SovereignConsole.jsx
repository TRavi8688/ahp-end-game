/**
 * hospain-v2-web/src/components/SovereignConsole.jsx
 *
 * Super Admin Panel — complete rewrite.
 * Tabs:
 *   1. Pending Approvals  — hospitals waiting for review, approve/reject
 *   2. All Hospitals      — every live hospital on the network
 *   3. Branch Analytics   — branch metrics (existing backend)
 *   4. EHR Passports      — patient records (existing backend)
 *   5. Bed Scheduler      — bed matrix (existing backend)
 *   6. Audit Ledger       — audit logs (existing backend)
 *   7. Hospain Team        — create/manage internal Hospain employees
 *
 * FIXES vs original:
 *  - axios → fetch (consistent with rest of codebase)
 *  - Added pending approvals tab wired to /onboarding/hospital-status
 *  - Approve → PATCH /onboarding/admin-approve-hospital/:id
 *  - Reject → POST /onboarding/reject-hospital/:id with reason → sends Twilio SMS + email
 *  - Hospain Team tab → POST /employees/create
 *  - All api calls use Bearer token from localStorage
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Users, BedDouble, FileText, ShieldAlert,
  RefreshCw, CheckCircle, X, Plus,
  Clock, Building2, Phone, Mail, Eye, XCircle,
  Hash, LogOut
} from 'lucide-react';
import { post } from '../lib/api';
import logoImg from '../assets/logo.png';

const API_BASE = '/api/v1';

const TEAM_LABELS  = { finance:'Finance', engineering:'Engineering', onboarding:'Onboarding', support:'Support', data:'Data' };
const LEVEL_LABELS = { l1:'L1 Agent', team_lead:'Team Lead', manager:'Manager' };
const LEVEL_COLOR  = {
  l1:        'bg-slate-700 text-slate-300',
  team_lead: 'bg-blue-900/60 text-blue-300',
  manager:   'bg-violet-900/60 text-violet-300',
};

function token() {
  return sessionStorage.getItem('hospain_owner_token') || localStorage.getItem('hospain_internal_token') || '';
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${token()}`, ...extra };
}

// ── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ hospital, onClose, onRejected }) {
  const [reason, setReason]   = useState('');
  const [fields, setFields]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const COMMON_REASONS = [
    'PAN card photo is blurry or unreadable',
    'NABH certificate is expired or invalid',
    'Director selfie does not match PAN card photo',
    'Registration number not found in government registry',
    'Physical address is incomplete or unverifiable',
    'Document uploaded is incorrect (wrong document type)',
  ];

  const submit = async () => {
    if (!reason.trim()) { setError('Please provide a rejection reason.'); return; }
    setLoading(true); setError('');
    try {
      await post(`/onboarding/reject-hospital/${hospital.hospital_id}`, {
        reason,
        reupload_fields: fields,
      });
      onRejected(hospital.hospital_id);
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to reject hospital.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50">
          <div className="flex items-center gap-2.5">
            <XCircle size={18} className="text-rose-600"/>
            <span className="font-black text-slate-900 text-sm">Reject — {hospital.name}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={16}/></button>
        </div>
        <div className="p-6 space-y-5">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">{error}</div>}

          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">Select Rejection Reason</label>
            <div className="space-y-2">
              {COMMON_REASONS.map(r => (
                <button key={r} type="button" onClick={() => setReason(r)}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all ${reason === r ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Or write a custom reason</label>
            <textarea value={reason} onChange={e => { setReason(e.target.value); setError(''); }} rows={3}
              placeholder="Explain exactly what needs to be corrected or re-uploaded…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:border-rose-400 focus:bg-white transition-all resize-none"/>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Documents to Re-upload</label>
            <div className="flex flex-wrap gap-2">
              {['PAN Card Photo', 'NABH Certificate', 'Director Selfie', 'All Documents'].map(f => (
                <button key={f} type="button" onClick={() => setFields(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f])}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${fields.includes(f) ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-[11px] text-amber-700 font-bold">
              The hospital owner will receive an SMS and email with this reason and instructions to re-upload.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
            <button onClick={submit} disabled={loading || !reason.trim()}
              className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2">
              {loading ? <><RefreshCw size={13} className="animate-spin"/>Sending…</> : 'Send Rejection →'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Create Employee Modal ─────────────────────────────────────────────────────
function CreateEmployeeModal({ isOpen, onClose, onCreated }) {
  const [f, setF]         = useState({ full_name: '', email: '', team: 'support', level: 'l1', phone: '' });
  const [loading, setLoad] = useState(false);
  const [error, setErr]   = useState('');
  const [created, setCr]  = useState(null);
  const set = k => v => setF(p => ({ ...p, [k]: v }));

  const TEAM_CODES  = { finance:'FIN', engineering:'ENG', onboarding:'ONB', support:'SUP', data:'DAT' };
  const LEVEL_CODES = { l1:'L1', team_lead:'TL', manager:'MGR' };

  const submit = async () => {
    if (!f.full_name.trim() || !f.email.trim()) { setErr('Name and email are required.'); return; }
    setLoad(true); setErr('');
    try {
      const data = await post('/employees/create', f);
      setCr(data);
      onCreated?.(data);
    } catch (e) { setErr(e.message || 'Failed to create employee.'); }
    finally { setLoad(false); }
  };

  const reset = () => { setF({ full_name:'', email:'', team:'support', level:'l1', phone:'' }); setErr(''); setCr(null); };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Users size={17} className="text-violet-600"/>
            <span className="font-black text-slate-900 text-sm">Create Hospain Employee</span>
          </div>
          <button onClick={() => { onClose(); reset(); }} className="text-slate-400 hover:text-slate-600 p-1"><X size={16}/></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-semibold">{error}</div>}

          {created ? (
            <div className="space-y-4">
              <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3">
                <p className="text-emerald-700 font-black text-sm flex items-center gap-2"><CheckCircle size={16}/>Employee Created!</p>
                <div className="space-y-2 text-xs">
                  {[
                    ['Employee ID', created.employee_id, 'font-mono font-black text-violet-700'],
                    ['Full Name',   created.full_name,   'font-bold text-slate-800'],
                    ['Team / Level', `${TEAM_LABELS[f.team]} / ${LEVEL_LABELS[f.level]}`, 'font-bold text-slate-700'],
                    ['Temp Password', created.temp_password, 'font-mono font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded'],
                  ].map(([k, v, cls]) => (
                    <div key={k} className="flex justify-between items-center gap-4">
                      <span className="text-slate-400 font-medium">{k}</span>
                      <span className={cls}>{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-amber-600 font-bold">⚠️ Copy the password now. It will not be shown again.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { onClose(); reset(); }} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50">Done</button>
                <button onClick={reset} className="flex-1 py-3 bg-violet-600 text-white font-bold text-xs rounded-xl hover:bg-violet-700">Create Another</button>
              </div>
            </div>
          ) : (
            <>
              {[
                { key: 'full_name', label: 'Full Name',     placeholder: 'e.g. Rajan Kumar',         type: 'text' },
                { key: 'email',     label: 'Work Email',    placeholder: 'rajan@hospain.in',          type: 'email' },
                { key: 'phone',     label: 'Phone (optional)', placeholder: '+91 98765 43210',         type: 'tel' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{field.label}</label>
                  <input type={field.type} value={f[field.key]} onChange={e => set(field.key)(e.target.value)} placeholder={field.placeholder}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:border-violet-400 focus:bg-white transition-all"/>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Team</label>
                  <select value={f.team} onChange={e => set('team')(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:border-violet-400 transition-all">
                    {Object.entries(TEAM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Level</label>
                  <select value={f.level} onChange={e => set('level')(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:border-violet-400 transition-all">
                    <option value="l1">L1 Agent</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>
              <div className="p-3.5 bg-violet-50 border border-violet-100 rounded-xl">
                <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1">Employee ID Preview</p>
                <p className="font-mono text-base font-black text-violet-800">
                  HPN-{TEAM_CODES[f.team]}-{LEVEL_CODES[f.level]}-XXX
                </p>
              </div>
              <button onClick={submit} disabled={loading}
                className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                {loading ? <><RefreshCw size={14} className="animate-spin"/>Creating…</> : 'Create Employee →'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Hospital Detail Modal ─────────────────────────────────────────────────────
function HospitalDetailModal({ hospital, onClose, onApprove, onReject }) {
  if (!hospital) return null;
  return (
    <div className="fixed inset-0 z-[2500] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-black text-slate-900">{hospital.name}</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{hospital.hospital_id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Owner Email', hospital.owner_email || '—'],
              ['Phone', hospital.phone || '—'],
              ['NABH Reg No.', hospital.registration_number || '—'],
              ['PAN Number', hospital.pan_number || '—'],
              ['Address', hospital.physical_address || hospital.address_line1 || '—'],
              ['City / State', `${hospital.city || '—'} / ${hospital.state || '—'}`],
              ['Staff Count', hospital.staff_count || '—'],
              ['Branches', hospital.branches || '1'],
              ['Submitted', new Date(hospital.created_at).toLocaleString('en-IN')],
              ['Status', hospital.status],
            ].map(([k, v]) => (
              <div key={k} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{k}</p>
                <p className="text-sm font-bold text-slate-800 mt-1 break-all">{v}</p>
              </div>
            ))}
          </div>

          {hospital.status === 'pending_verification' && (
            <div className="flex gap-3 pt-2">
              <button onClick={() => onReject(hospital)} className="flex-1 py-3.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-sm rounded-2xl hover:bg-rose-100 transition-all flex items-center justify-center gap-2">
                <XCircle size={16}/> Reject & Request Re-upload
              </button>
              <button onClick={() => onApprove(hospital.hospital_id)} className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                <CheckCircle size={16}/> Approve Hospital
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main SovereignConsole ─────────────────────────────────────────────────────
export default function SovereignConsole({ onLogout }) {
  const [activeTab, setActiveTab] = useState('pending');

  // Data states
  const [pending,   setPending]   = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [branches,  setBranches]  = useState([]);
  const [passports, setPassports] = useState([]);
  const [beds,      setBeds]      = useState([]);
  const [ledger,    setLedger]    = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading,      setLoading]      = useState(true);
  const [approving,    setApproving]    = useState(null);  // hospital_id being approved
  const [rejectTarget, setRejectTarget] = useState(null);  // hospital to reject
  const [detailTarget, setDetailTarget] = useState(null);  // hospital to inspect
  const [createEmpOpen, setEmpOpen]     = useState(false);
  const [actionMsg,    setActionMsg]    = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const headers = authHeaders();

      const [pendingRes, hospitalsRes, branchRes, ehrRes, bedRes, auditRes, empRes] = await Promise.allSettled([
        fetch(`${API_BASE}/onboarding/pending-hospitals`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/hospitals/list`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/owner/branch-metrics`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/owner/ehr-passports`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/owner/bed-matrix`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/owner/audit-ledger`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/employees/list`, { headers }).then(r => r.json()),
      ]);

      if (pendingRes.status === 'fulfilled')   setPending(pendingRes.value?.hospitals || []);
      if (hospitalsRes.status === 'fulfilled') setHospitals(hospitalsRes.value?.hospitals || []);
      if (branchRes.status === 'fulfilled')    setBranches(branchRes.value?.branches || []);
      if (ehrRes.status === 'fulfilled')       setPassports(ehrRes.value?.passports || []);
      if (bedRes.status === 'fulfilled')       setBeds(bedRes.value?.beds || []);
      if (auditRes.status === 'fulfilled')     setLedger(auditRes.value?.ledger || []);
      if (empRes.status === 'fulfilled')       setEmployees(empRes.value?.employees || []);
    } catch (err) {
      console.error('SovereignConsole fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleApprove = async (hospitalId) => {
    setApproving(hospitalId);
    setDetailTarget(null);
    try {
      await post(`/onboarding/admin-approve-hospital/${hospitalId}`, {});
      setPending(p => p.filter(h => h.hospital_id !== hospitalId));
      setActionMsg('Hospital approved. Owner has been notified via SMS.');
      setTimeout(() => setActionMsg(''), 4000);
      fetchAll();
    } catch (e) {
      alert('Approval failed: ' + e.message);
    } finally {
      setApproving(null);
    }
  };

  const handleRejected = (hospitalId) => {
    setPending(p => p.filter(h => h.hospital_id !== hospitalId));
    setActionMsg('Rejection sent. Owner will receive SMS and email with instructions.');
    setTimeout(() => setActionMsg(''), 4000);
  };

  const TABS = [
    { id: 'pending',   icon: Clock,       label: 'Pending Approvals', badge: pending.length },
    { id: 'hospitals', icon: Building2,   label: 'All Hospitals' },
    { id: 'branch',    icon: Activity,    label: 'Branch Analytics' },
    { id: 'ehr',       icon: FileText,    label: 'EHR Passports' },
    { id: 'beds',      icon: BedDouble,   label: 'Bed Scheduler' },
    { id: 'audit',     icon: ShieldAlert, label: 'Audit Ledger' },
    { id: 'team',      icon: Users,       label: 'Hospain Team' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-inter overflow-hidden">

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col p-5 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2 font-black text-xl tracking-tight mb-8">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center"><img src={logoImg} alt="Hospain" className="w-full h-full object-contain"/></div>
          <span>HOSPAIN<span className="text-violet-600">.</span></span>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-1">ADMIN</span>
        </div>

        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 px-2">Control Panel</div>
        <nav className="flex-1 space-y-1">
          {TABS.map(({ id, icon: Icon, label, badge }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === id ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}>
              <span className="flex items-center gap-2.5"><Icon size={15}/>{label}</span>
              {badge > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === id ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'}`}>{badge}</span>}
            </button>
          ))}
        </nav>

        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          <button onClick={fetchAll} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
            <RefreshCw size={13}/> Refresh Data
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <LogOut size={13}/> Secure Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Action message */}
        <AnimatePresence>
          {actionMsg && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="sticky top-0 z-20 mx-6 mt-4 p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-3">
              <CheckCircle size={18}/><p className="text-sm font-bold">{actionMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-end border-b border-slate-200 pb-5 mb-8">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {TABS.find(t => t.id === activeTab)?.label}
              </h1>
              <p className="text-sm text-slate-400 font-medium mt-1">
                {activeTab === 'pending'   && `${pending.length} hospital${pending.length !== 1 ? 's' : ''} awaiting review`}
                {activeTab === 'hospitals' && `${hospitals.length} hospitals on the Hospain network`}
                {activeTab === 'team'      && `${employees.length} Hospain team members`}
                {!['pending','hospitals','team'].includes(activeTab) && 'Live data from all verified hospitals'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {loading && <RefreshCw size={16} className="text-violet-400 animate-spin"/>}
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1.5 rounded-full text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>LIVE SYNC
              </div>
            </div>
          </div>

          {/* ── PENDING APPROVALS ─────────────────────────────────────────── */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pending.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center">
                    <CheckCircle size={28} className="text-emerald-500"/>
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-lg">All Clear!</p>
                    <p className="text-slate-400 text-sm mt-1">No hospitals pending approval.</p>
                  </div>
                </div>
              )}
              {pending.map(h => (
                <div key={h.hospital_id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-black text-slate-900 text-base">{h.name}</h3>
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                          Pending Review
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {[
                          [Mail, h.owner_email || '—'],
                          [Phone, h.phone || '—'],
                          [Hash, h.registration_number || '—'],
                          [Clock, new Date(h.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })],
                        ].map(([Icon, val], i) => (
                          <div key={i} className="flex items-center gap-1.5 text-slate-500 font-medium">
                            <Icon size={12} className="text-slate-400 shrink-0"/><span className="truncate">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setDetailTarget(h)} className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all">
                        <Eye size={14}/> Review
                      </button>
                      <button onClick={() => setRejectTarget(h)} className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 border border-rose-100 text-rose-600 font-bold text-xs rounded-xl hover:bg-rose-100 transition-all">
                        <XCircle size={14}/> Reject
                      </button>
                      <button onClick={() => handleApprove(h.hospital_id)} disabled={approving === h.hospital_id}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-60">
                        {approving === h.hospital_id ? <RefreshCw size={13} className="animate-spin"/> : <CheckCircle size={13}/>}
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ALL HOSPITALS ─────────────────────────────────────────────── */}
          {activeTab === 'hospitals' && (
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Hospital Name','Owner Email','City','Reg. No.','Status','Joined'].map(h => (
                      <th key={h} className="p-4 font-black uppercase tracking-wider text-slate-400 text-[9px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {hospitals.length === 0 && (
                    <tr><td colSpan={6} className="p-10 text-center text-slate-400">No hospitals found.</td></tr>
                  )}
                  {hospitals.map(h => (
                    <tr key={h.id || h.hospital_id} className="hover:bg-slate-50/50 transition-all">
                      <td className="p-4 font-bold text-slate-900">{h.name}</td>
                      <td className="p-4 text-slate-500 font-medium">{h.email || h.owner_email || '—'}</td>
                      <td className="p-4 text-slate-500">{h.city || '—'}</td>
                      <td className="p-4 font-mono text-slate-400 text-[10px]">{h.registration_number || '—'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide ${
                          h.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          h.status === 'pending_verification' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {h.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 font-medium">{h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── BRANCH ANALYTICS ──────────────────────────────────────────── */}
          {activeTab === 'branch' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {branches.length === 0 && <p className="col-span-3 text-slate-400 text-sm py-10 text-center">No branch data available.</p>}
              {branches.map(b => (
                <div key={b.branch_id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                  <h3 className="font-black text-slate-900 text-sm mb-4 pb-3 border-b border-slate-100">{b.name}</h3>
                  <div className="space-y-3 text-xs">
                    {[['Active Patients', b.active_patients],['Doctors on Duty', b.doctors_on_duty],['Avg Wait Time', b.avg_wait_time]].map(([k,v])=>(
                      <div key={k} className="flex justify-between font-medium">
                        <span className="text-slate-400">{k}</span>
                        <span className="text-slate-900 font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── EHR PASSPORTS ─────────────────────────────────────────────── */}
          {activeTab === 'ehr' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{['Patient Name','Health ID','Consent','Vitals'].map(h=><th key={h} className="p-4 font-black uppercase tracking-wider text-slate-400 text-[9px]">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {passports.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-400">No patients registered yet.</td></tr>}
                  {passports.map(p => (
                    <tr key={p.patient_id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-bold text-slate-900">{p.name}</td>
                      <td className="p-4 font-mono text-slate-400">{p.health_id}</td>
                      <td className="p-4"><span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[9px] font-black">{p.dynamic_consent}</span></td>
                      <td className="p-4 text-slate-500">{p.vitals_state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── BED SCHEDULER ─────────────────────────────────────────────── */}
          {activeTab === 'beds' && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {beds.length === 0 && <p className="col-span-6 text-slate-400 text-sm py-10 text-center">No beds configured.</p>}
              {beds.map(bed => (
                <div key={bed.id} className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-sm">
                  <span className="text-xs font-black text-slate-900">{bed.bed_number}</span>
                  <span className={`mt-2 block px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    bed.status === 'available' ? 'bg-emerald-50 text-emerald-600' :
                    bed.status === 'occupied'  ? 'bg-amber-50 text-amber-600' :
                    'bg-rose-50 text-rose-600'
                  }`}>{bed.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── AUDIT LEDGER ──────────────────────────────────────────────── */}
          {activeTab === 'audit' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{['Timestamp','Actor','Action','Details'].map(h=><th key={h} className="p-4 font-black uppercase tracking-wider text-slate-400 text-[9px]">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ledger.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-400">No audit logs found.</td></tr>}
                  {ledger.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-mono text-slate-400">{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                      <td className="p-4 font-bold text-slate-900">{log.actor} <span className="text-slate-400 font-normal">({log.actor_email})</span></td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black tracking-wide ${log.action?.includes('OVERRIDE') ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 max-w-xs truncate">{JSON.stringify(log.details)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── HOSPAIN TEAM ───────────────────────────────────────────────── */}
          {activeTab === 'team' && (
            <div className="space-y-5">
              <div className="flex justify-end">
                <button onClick={() => setEmpOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-violet-200">
                  <Plus size={14}/> Create Employee
                </button>
              </div>

              <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {['Employee ID','Name','Email','Team','Level','Status','Open Tickets'].map(h => (
                        <th key={h} className="p-4 font-black uppercase tracking-wider text-slate-400 text-[9px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {employees.length === 0 && (
                      <tr><td colSpan={7} className="p-10 text-center text-slate-400">No Hospain employees yet. Create the first one above.</td></tr>
                    )}
                    {employees.map(e => (
                      <tr key={e.employee_id} className="hover:bg-slate-50/50 transition-all">
                        <td className="p-4 font-mono font-black text-violet-600 text-[11px]">{e.employee_id}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center text-[10px] font-black text-violet-600">{e.avatar_initials || '??'}</div>
                            <span className="font-bold text-slate-900">{e.full_name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500">{e.email}</td>
                        <td className="p-4 font-bold text-slate-700">{TEAM_LABELS[e.team] || e.team}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide ${LEVEL_COLOR[e.level] || 'bg-slate-100 text-slate-500'}`}>
                            {LEVEL_LABELS[e.level] || e.level}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${e.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {e.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-4 font-black text-blue-600">{e.open_tickets || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {rejectTarget && (
        <RejectModal
          hospital={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={handleRejected}
        />
      )}
      {detailTarget && (
        <HospitalDetailModal
          hospital={detailTarget}
          onClose={() => setDetailTarget(null)}
          onApprove={handleApprove}
          onReject={(h) => { setDetailTarget(null); setRejectTarget(h); }}
        />
      )}
      <CreateEmployeeModal
        isOpen={createEmpOpen}
        onClose={() => setEmpOpen(false)}
        onCreated={emp => setEmployees(p => [emp, ...p])}
      />
    </div>
  );
}
