/**
 * src/pages/matrix/EmployeeAccounts.jsx — Hospain Matrix 3.0
 *
 * HR/Super Admin tool to create new employee accounts.
 * Generates Employee ID (6-char with H and R) + temp password.
 * Employee must change password on first login.
 */
import React, { useState } from 'react';
import {
  UserPlus, Copy, CheckCircle, AlertTriangle,
  IdCard, Loader2, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/apiClient';

const ROLES = [
  { value:'l1',           label:'L1 Agent — Front-line support' },
  { value:'l2',           label:'L2 Agent — Advanced support' },
  { value:'team_lead',    label:'Team Lead' },
  { value:'manager',      label:'Manager' },
  { value:'finance',      label:'Finance' },
  { value:'engineering',  label:'Engineering' },
  { value:'onboarding',   label:'Onboarding' },
  { value:'data',         label:'Data' },
  { value:'verification', label:'Verification' },
  { value:'hr',           label:'HR' },
  { value:'admin',        label:'Admin' },
];

export default function EmployeeAccounts() {
  const [form, setForm] = useState({ full_name:'', email:'', phone_number:'', role:'l1' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api.post('/api/v1/auth/employees/create', form);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to create employee account.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const reset = () => {
    setResult(null);
    setError('');
    setForm({ full_name:'', email:'', phone_number:'', role:'l1' });
  };

  const inputStyle = {
    width:'100%', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
    borderRadius:8, padding:'10px 14px', color:'#f1f5f9', fontSize:13, outline:'none',
    boxSizing:'border-box', fontFamily:'Inter, system-ui, sans-serif', transition:'border-color 0.15s',
  };

  return (
    <div style={{ padding:32, maxWidth:600, margin:'0 auto' }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', margin:'0 0 6px' }}>
          Create Employee Account
        </h1>
        <p style={{ fontSize:13, color:'#64748b', margin:0 }}>
          Generate Employee ID and temporary password for a new Hospain team member.
        </p>
      </div>

      {/* How it works */}
      <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.12)', borderRadius:12, padding:'14px 16px', marginBottom:24 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#818cf8', marginBottom:8 }}>📋 How Employee IDs work</div>
        <div style={{ fontSize:12, color:'#64748b', lineHeight:1.8 }}>
          • <strong style={{ color:'#94a3b8' }}>6 characters</strong>, always containing <strong style={{ color:'#818cf8' }}>H</strong> and <strong style={{ color:'#818cf8' }}>R</strong> (Hospain HR branding)<br/>
          • Mix of uppercase letters and digits — e.g. <code style={{ color:'#818cf8', fontFamily:'monospace' }}>H3RK9N</code>, <code style={{ color:'#818cf8', fontFamily:'monospace' }}>7HR2K4</code><br/>
          • Employee logs in with their ID + temp password<br/>
          • <strong style={{ color:'#f59e0b' }}>First login forces a permanent password change</strong>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="result"
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:16, padding:24 }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <CheckCircle size={20} color="#10b981" />
              <span style={{ fontSize:15, fontWeight:700, color:'#10b981' }}>Account Created!</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Employee ID */}
              <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:10, color:'#475569', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                  Employee ID — Share with {result.full_name}
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'monospace', fontSize:28, fontWeight:900, color:'#818cf8', letterSpacing:'0.18em' }}>
                    {result.employee_id}
                  </span>
                  <button onClick={() => copyToClipboard(result.employee_id, 'eid')}
                    style={{ padding:'6px 12px', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:7, color:'#818cf8', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                    {copied === 'eid' ? <><CheckCircle size={11} />Copied!</> : <><Copy size={11} />Copy</>}
                  </button>
                </div>
              </div>

              {/* Temp Password */}
              <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:10, color:'#f59e0b', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                  ⚠️ Temporary Password — Share Securely (One-Time)
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'monospace', fontSize:18, fontWeight:700, color:'#fbbf24', letterSpacing:'0.1em' }}>
                    {result.temp_password}
                  </span>
                  <button onClick={() => copyToClipboard(result.temp_password, 'pwd')}
                    style={{ padding:'6px 12px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:7, color:'#f59e0b', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                    {copied === 'pwd' ? <><CheckCircle size={11} />Copied!</> : <><Copy size={11} />Copy</>}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div style={{ fontSize:12, color:'#64748b', padding:'10px 12px', background:'rgba(0,0,0,0.2)', borderRadius:8, lineHeight:1.7 }}>
                Tell <strong style={{ color:'#94a3b8' }}>{result.full_name}</strong> to go to{' '}
                <code style={{ color:'#818cf8' }}>matrix.hospain.in</code>, enter their Employee ID{' '}
                <code style={{ color:'#818cf8' }}>{result.employee_id}</code> and the temporary password.{' '}
                They will be immediately prompted to set a permanent password.
              </div>
            </div>

            <button onClick={reset}
              style={{ marginTop:18, padding:'10px 20px', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:8, color:'#818cf8', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7 }}>
              <RefreshCw size={13} />
              Create Another Account
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity:0 }} animate={{ opacity:1 }}
            onSubmit={handleCreate}
            style={{ display:'flex', flexDirection:'column', gap:16 }}
          >
            {[
              { key:'full_name',    label:'Full Name',            placeholder:'Jane Doe',              required:true,  type:'text' },
              { key:'email',        label:'Work Email (optional)', placeholder:'jane@hospain.in',       required:false, type:'email' },
              { key:'phone_number', label:'Phone (optional)',      placeholder:'+91 98765 43210',       required:false, type:'tel' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:7 }}>
                  {f.label}
                </label>
                <input
                  type={f.type}
                  required={f.required}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                  placeholder={f.placeholder}
                  onFocus={e => { e.target.style.borderColor='rgba(99,102,241,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.08)'; }}
                  onBlur={e =>  { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }}
                />
              </div>
            ))}

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:7 }}>
                Role
              </label>
              <select
                value={form.role}
                onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                style={{ ...inputStyle, cursor:'pointer' }}
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  style={{ display:'flex', gap:10, padding:'12px 14px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.2)', borderRadius:10 }}>
                  <AlertTriangle size={14} color="#fb7185" style={{ flexShrink:0, marginTop:1 }} />
                  <p style={{ fontSize:12, color:'#fb7185', margin:0 }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading}
              style={{ padding:'13px 20px', background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #4f46e5)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:10, color:'#fff', fontSize:13, fontWeight:700, cursor: loading ? 'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow: loading?'none':'0 0 30px rgba(99,102,241,0.2)', transition:'all 0.2s' }}>
              {loading
                ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} />Creating account…</>
                : <><UserPlus size={15} />Generate Employee ID & Credentials</>
              }
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
