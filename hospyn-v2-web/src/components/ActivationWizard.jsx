/**
 * hospain-v2-web/src/components/ActivationWizard.jsx
 *
 * UPDATED FLOW:
 *  Step 1 — Corporate Coordinates (hospital info, address, branches)
 *  Step 2 — Documents (photo, PAN card, license — all optional at entry, collected
 *            for super-admin review. No document blocks the user from progressing.)
 *  Step 3 — Phone + Email OTP verification (dual OTP)
 *  Step 4 — Application Submitted (pending_verification)
 *
 * KEY DESIGN PRINCIPLE: We collect all documents upfront but NEVER reject the
 * user at entry. If documents are wrong or fake, super-admin will reject the
 * application. The gate is at our review, not at their registration step.
 *
 * Auth: token stored in sessionStorage (not localStorage) — PHI security fix.
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle, Check, AlertCircle, RefreshCw, MapPin,
  Eye, EyeOff, Clock, Upload, Camera, CreditCard, FileText,
  Image as ImageIcon
} from 'lucide-react';
import { post, postForm, postMultipart } from '../lib/api';
import logoImg from '../assets/logo.png';

// ─── Validators ──────────────────────────────────────────────────────────────
const V = {
  hospitalName: v => {
    if (!v?.trim() || v.trim().length < 3) return 'Minimum 3 characters required';
    if (!/^[a-zA-Z\s\-\.']+$/.test(v.trim())) return 'Only letters, spaces, hyphens allowed';
    if (v.trim().length > 120) return 'Name too long (max 120 characters)';
    return '';
  },
  staffCount: v => {
    const n = Number(v);
    if (!v || v === '') return 'Staff count is required';
    if (isNaN(n) || !Number.isInteger(n)) return 'Must be a whole number';
    if (n < 1) return 'Minimum 1 staff member';
    if (n > 50000) return 'Maximum 50,000';
    return '';
  },
  email: v => {
    if (!v?.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return 'Enter a valid email';
    return '';
  },
  password: v => {
    if (!v || v.length < 8) return 'Minimum 8 characters';
    if (!/[A-Z]/.test(v)) return 'Add at least one uppercase letter';
    if (!/[0-9]/.test(v)) return 'Add at least one number';
    if (!/[^a-zA-Z0-9]/.test(v)) return 'Add at least one special character (!@#$...)';
    return '';
  },
  nabh: v => {
    if (!v?.trim()) return 'Registration number is required';
    if (v.trim().length < 5) return 'Enter a valid registration number (min 5 chars)';
    return '';
  },
  phone: v => {
    const d = v?.replace(/\D/g, '');
    if (!d?.length) return 'Phone number is required';
    if (!/^[6-9]\d{9}$/.test(d)) return 'Must be a valid 10-digit Indian mobile';
    return '';
  },
  street: v => (!v?.trim() || v.trim().length < 5) ? 'Street address required (min 5 chars)' : '',
  city:   v => (!v?.trim()) ? 'City is required' : '',
  state:  v => (!v?.trim()) ? 'State is required' : '',
  pinCode: v => (!/^\d{6}$/.test(v?.trim())) ? 'Must be a 6-digit PIN code' : '',
};

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-[10px] font-bold text-rose-600 flex items-center gap-1"><AlertCircle size={10}/>{msg}</p>;
}

function VInput({ id, label, type='text', value, onChange, validate, placeholder, required, maxLength, inputMode, autoComplete, className='' }) {
  const [touched, setTouched] = useState(false);
  const err = touched ? validate?.(value) : '';
  const ok  = touched && !validate?.(value) && value;
  return (
    <div>
      <label className="block text-slate-700 text-[11px] font-semibold mb-1.5" htmlFor={id}>
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} onBlur={() => setTouched(true)}
          placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} autoComplete={autoComplete}
          className={`w-full border rounded-xl p-3.5 text-slate-900 text-sm outline-none transition-all pr-9 ${
            err ? 'bg-rose-50/60 border-rose-300 focus:border-rose-400' :
            ok  ? 'bg-emerald-50/60 border-emerald-300' :
            'bg-slate-50 border-slate-200 focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10'
          } ${className}`}
        />
        {touched && value && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {err ? <AlertCircle size={15} className="text-rose-400"/> : <CheckCircle size={15} className="text-emerald-500"/>}
          </span>
        )}
      </div>
      <FieldError msg={err}/>
    </div>
  );
}

// ─── Document Upload Widget ───────────────────────────────────────────────────
function DocUpload({ label, hint, icon: Icon, file, onFile, accept = 'image/*,.pdf' }) {
  const ref = useRef();
  const hasFile = !!file;
  return (
    <div>
      <label className="block text-slate-700 text-[11px] font-semibold mb-1.5">{label}
        <span className="ml-1.5 text-[10px] font-medium text-slate-400 normal-case">(optional — reviewed by our team)</span>
      </label>
      <button type="button" onClick={() => ref.current?.click()}
        className={`w-full border-2 border-dashed rounded-2xl p-5 flex flex-col items-center gap-2.5 transition-all ${
          hasFile
            ? 'border-emerald-300 bg-emerald-50/50 text-emerald-700'
            : 'border-slate-200 bg-slate-50/50 hover:border-violet-300 hover:bg-violet-50/30 text-slate-500'
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasFile ? 'bg-emerald-100' : 'bg-white border border-slate-200'}`}>
          {hasFile ? <CheckCircle size={20} className="text-emerald-500"/> : <Icon size={18} className="text-slate-400"/>}
        </div>
        <div className="text-center">
          <p className="text-xs font-bold">{hasFile ? file.name : `Upload ${label}`}</p>
          {!hasFile && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
          {hasFile && <p className="text-[10px] text-emerald-600 mt-0.5">{(file.size / 1024).toFixed(0)} KB — click to replace</p>}
        </div>
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ActivationWizard({ isOpen, onClose, onActivationSuccess, onLoginRedirect }) {
  const [step, setStep] = useState(1);   // 1=Coords, 2=Docs, 3=OTP, 4=Submitted
  const [loading, setLoading] = useState(false);
  const [hospitalId, setHospitalId] = useState(null);
  const [globalErr, setGlobalErr] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  // Step 1 fields
  const [f, setF] = useState({
    name: '', owner_email: '', owner_password: '', registration_number: '',
    staff_count: '', phone_number: '', physical_address: '',
    latitude: '', longitude: '', branches: '',
  });
  const set = k => v => setF(p => ({ ...p, [k]: v }));

  const [addressParts, setAddressParts] = useState({ street: '', city: '', state: '', pinCode: '' });
  const updateAddress = (key, val) => {
    const next = { ...addressParts, [key]: val };
    setAddressParts(next);
    const combined = [next.street, next.city, next.state, next.pinCode].filter(Boolean).join(', ');
    set('physical_address')(combined);
  };

  const [hasBranches, setHasBranches] = useState(false);
  const [branchAddresses, setBranchAddresses] = useState({});

  // Step 2: documents (all optional — no rejection at entry)
  const [docPhoto, setDocPhoto]     = useState(null);  // Director/owner selfie
  const [docPan, setDocPan]         = useState(null);  // PAN card photo
  const [docLicense, setDocLicense] = useState(null);  // NABH / hospital license

  // Step 3: OTP
  const [otp, setOtp]           = useState('');
  const [simOtp, setSimOtp]     = useState('');

  // Step 1 validation
  const s1Errors = {
    name: V.hospitalName(f.name), staff_count: V.staffCount(f.staff_count),
    owner_email: V.email(f.owner_email), owner_password: V.password(f.owner_password),
    registration_number: V.nabh(f.registration_number), phone_number: V.phone(f.phone_number),
    street: V.street(addressParts.street), city: V.city(addressParts.city),
    state: V.state(addressParts.state), pinCode: V.pinCode(addressParts.pinCode),
  };
  const s1Valid = Object.values(s1Errors).every(e => !e);

  const detectGeo = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      p => { setF(prev => ({ ...prev, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })); setLoading(false); },
      () => { setGlobalErr('Location denied. Enter coordinates manually.'); setLoading(false); }
    );
  };

  // ── Step 1 → 2: register hospital, move to doc collection ─────────────────
  const submitStep1 = async () => {
    if (!s1Valid) { setGlobalErr('Please fix the errors above before continuing.'); return; }
    setLoading(true); setGlobalErr('');

    const branches = hasBranches ? f.branches.split(',').map(b => b.trim()).filter(Boolean) : [];
    const branchLocs = branches.map(b => branchAddresses[b] || `${f.physical_address} (${b})`);

    try {
      const data = await post('/onboarding/register-enterprise-simple', {
        hospital_id:     hospitalId,
        name:            f.name,
        registration_number: f.registration_number,
        owner_email:     f.owner_email,
        owner_password:  f.owner_password,
        phone_number:    f.phone_number,
        physical_address: f.physical_address,
        staff_count:     f.staff_count,
        latitude:        f.latitude || undefined,
        longitude:       f.longitude || undefined,
        branches:        hasBranches ? f.branches : '',
        branch_locations: hasBranches ? branchLocs.join(';') : '',
      });

      setHospitalId(data.hospital_id);
      setStep(2);
    } catch (e) {
      if (e.status === 409) {
        setShowLoginPopup(true);
      } else {
        setGlobalErr(e.message || 'Registration failed. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 → 3: upload documents (fire-and-forget — never blocks) then send OTP ──
  const submitStep2 = async () => {
    setLoading(true); setGlobalErr('');
    try {
      // Upload documents if provided — non-blocking, failures don't stop flow
      if (docPhoto || docPan || docLicense) {
        try {
          const fd = new FormData();
          if (docPhoto)   fd.append('selfie', docPhoto);
          if (docPan)     fd.append('pan_card_photo', docPan);
          if (docLicense) fd.append('certificate', docLicense);
          // Best-effort — we don't throw if this fails; super-admin can request resubmission
          await postMultipart(`/onboarding/upload-documents/${hospitalId}`, fd);
        } catch (uploadErr) {
          // Log but don't block — admin will see "documents missing" and can request later
          console.warn('Document upload partial failure:', uploadErr.message);
        }
      }

      // Send OTP (this must succeed)
      const otpData = await post(`/onboarding/send-government-pan-otp/${hospitalId}`, {});
      setSimOtp(otpData.simulated_otp || '');
      setStep(3);
    } catch (e) {
      setGlobalErr(e.message || 'Failed to send OTP. Please check your phone number and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3 → 4: verify OTP ────────────────────────────────────────────
  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp))      { setGlobalErr('Enter the 6-digit OTP sent to your phone.'); return; }
    setLoading(true); setGlobalErr('');
    try {
      await postForm(`/onboarding/verify-government-pan-otp/${hospitalId}`, {
        otp_code: otp,
      });
      setStep(4);
      onActivationSuccess?.({
        hospital_id: hospitalId,
        name: f.name,
        owner_email: f.owner_email,
        status: 'pending_verification',
      });
    } catch (e) {
      setGlobalErr(e.message || 'Invalid OTP — check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const branchList = f.branches.split(',').map(b => b.trim()).filter(Boolean);
  const steps = ['Hospital Details', 'Documents', 'Verify Identity', 'Submitted'];

  const reset = () => {
    setStep(1); setHospitalId(null); setGlobalErr(''); setShowPw(false); setShowLoginPopup(false);
    setF({ name:'', owner_email:'', owner_password:'', registration_number:'', staff_count:'', phone_number:'', physical_address:'', latitude:'', longitude:'', branches:'' });
    setAddressParts({ street:'', city:'', state:'', pinCode:'' });
    setHasBranches(false); setBranchAddresses({});
    setDocPhoto(null); setDocPan(null); setDocLicense(null);
    setOtp(''); setSimOtp('');
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] bg-slate-900/75 backdrop-blur-md overflow-y-auto flex items-start lg:items-center justify-center p-4 lg:p-8">
          <motion.div initial={{ scale: 0.97, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 16 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl flex flex-col lg:flex-row overflow-hidden my-4">

            {/* ── Sidebar Rail ────────────────────────────────────────────── */}
            <div className="bg-slate-50 lg:w-[34%] p-8 lg:p-10 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200">
              <div className="flex items-center gap-2.5 mb-7">
                <img src={logoImg} alt="Hospain" className="w-8 h-8 object-contain"/>
                <span className="font-black text-slate-900 tracking-tight text-lg">Hospain</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 leading-tight mb-1.5">Hospital Registration</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-8">
                Register now. Our team reviews and verifies every hospital before activation.
              </p>

              <div className="space-y-5 flex-1">
                {steps.map((lbl, i) => {
                  const s = i + 1;
                  return (
                    <div key={s} className="flex gap-3 items-start">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                        step > s  ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' :
                        step === s ? 'bg-violet-600 text-white shadow-md' :
                        'bg-white border border-slate-200 text-slate-400'
                      }`}>
                        {step > s ? <Check size={13} strokeWidth={3}/> : s}
                      </div>
                      <p className={`text-[11px] font-bold pt-1 ${
                        step === s ? 'text-violet-600' :
                        step > s   ? 'text-slate-400 line-through' : 'text-slate-500'
                      }`}>{lbl}</p>
                    </div>
                  );
                })}
              </div>

              {/* Trust note */}
              <div className="mt-8 p-4 bg-violet-50 border border-violet-100 rounded-2xl">
                <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-1">Why we collect documents</p>
                <p className="text-[10px] text-violet-600 leading-relaxed">
                  We verify every hospital against government registries. If submitted documents appear incorrect,
                  our team will contact you — no automatic rejection.
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200 flex items-center justify-between text-slate-400 text-[10px] font-medium">
                <span>Care beyond today</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
              </div>
            </div>

            {/* ── Workspace ────────────────────────────────────────────────── */}
            <div className="flex-1 p-7 lg:p-10 bg-white relative flex flex-col">
              {showLoginPopup && (
                <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="text-rose-500" size={32} />
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-2">Account Already Exists</h4>
                  <p className="text-slate-500 text-sm max-w-sm mb-6">
                    An account with the email <strong className="text-slate-800">{f.owner_email}</strong> is already registered. Please log in to your existing account.
                  </p>
                  <div className="flex gap-3 w-full max-w-xs">
                    <button type="button" onClick={() => { setShowLoginPopup(false); onLoginRedirect ? onLoginRedirect() : handleClose(); }}
                      className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-lg">
                      Go to Login
                    </button>
                    <button type="button" onClick={() => setShowLoginPopup(false)}
                      className="px-4 py-3 border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition-all">
                      Edit Email
                    </button>
                  </div>
                </div>
              )}

              <button onClick={handleClose} className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                <X size={18}/>
              </button>

              <div className="max-w-lg w-full mx-auto flex-1 flex flex-col justify-center space-y-5">
                {globalErr && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs">
                    <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5"/>
                    <p className="text-rose-700 font-semibold flex-1 leading-relaxed">{globalErr}</p>
                    <button onClick={() => setGlobalErr('')}><X size={13} className="text-rose-400"/></button>
                  </div>
                )}

                <AnimatePresence mode="wait">

                  {/* ═══ STEP 1 — Corporate Coordinates ═══════════════════════ */}
                  {step === 1 && (
                    <motion.div key="s1" initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-12 }} className="space-y-5">
                      <div>
                        <h4 className="text-xl font-black text-slate-900">Hospital Details</h4>
                        <p className="text-slate-400 text-xs mt-1">Basic info about your hospital. Verification happens after submission — no documents needed yet.</p>
                      </div>

                      <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1.5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <VInput id="name" label="Hospital Name" value={f.name} onChange={set('name')} validate={V.hospitalName} placeholder="e.g. Apollo Spectra" required/>
                          <VInput id="staff_count" label="Total Staff Count" type="number" value={f.staff_count} onChange={set('staff_count')} validate={V.staffCount} placeholder="e.g. 50" required inputMode="numeric"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <VInput id="owner_email" label="Administrator Email" type="email" value={f.owner_email} onChange={set('owner_email')} validate={V.email} placeholder="owner@hospital.com" required autoComplete="email"/>
                          <div>
                            <label className="block text-slate-700 text-[11px] font-semibold mb-1.5">Console Password<span className="text-rose-500 ml-0.5">*</span></label>
                            <div className="relative">
                              <input type={showPw ? 'text' : 'password'} value={f.owner_password} onChange={e => set('owner_password')(e.target.value)}
                                placeholder="Min 8, 1 uppercase, 1 number, 1 symbol"
                                className={`w-full border rounded-xl p-3.5 text-sm outline-none transition-all pr-9 ${
                                  f.owner_password && V.password(f.owner_password) ? 'bg-rose-50/60 border-rose-300' :
                                  f.owner_password && !V.password(f.owner_password) ? 'bg-emerald-50/60 border-emerald-300' :
                                  'bg-slate-50 border-slate-200 focus:bg-white focus:border-violet-500'
                                }`}/>
                              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                              </button>
                            </div>
                            {f.owner_password && <FieldError msg={V.password(f.owner_password)}/>}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <VInput id="registration_number" label="NABH / Registration No." value={f.registration_number} onChange={set('registration_number')} validate={V.nabh} placeholder="e.g. NABH-2026-908" required/>
                          <VInput id="phone_number" label="Contact Phone (OTP sent here)" type="tel" value={f.phone_number} onChange={set('phone_number')} validate={V.phone} placeholder="10-digit Indian mobile" required inputMode="tel"/>
                        </div>

                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hospital Address</p>
                          <VInput id="street" label="Street Address" value={addressParts.street} onChange={val => updateAddress('street', val)} validate={V.street} placeholder="Flat/House No, Building, Street, Area" required/>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <VInput id="city" label="City" value={addressParts.city} onChange={val => updateAddress('city', val)} validate={V.city} placeholder="e.g. Hyderabad" required/>
                            <VInput id="state" label="State" value={addressParts.state} onChange={val => updateAddress('state', val)} validate={V.state} placeholder="e.g. Telangana" required/>
                            <VInput id="pinCode" label="PIN Code" value={addressParts.pinCode} onChange={val => updateAddress('pinCode', val)} validate={V.pinCode} placeholder="e.g. 500081" required maxLength={6} inputMode="numeric"/>
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-2 items-end">
                          <div className="col-span-2">
                            <label className="block text-slate-700 text-[11px] font-semibold mb-1.5">Latitude <span className="text-slate-400 font-normal">(optional)</span></label>
                            <input type="text" value={f.latitude} onChange={e => set('latitude')(e.target.value)} placeholder="e.g. 17.3850" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:border-violet-500 transition-all"/>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-slate-700 text-[11px] font-semibold mb-1.5">Longitude <span className="text-slate-400 font-normal">(optional)</span></label>
                            <input type="text" value={f.longitude} onChange={e => set('longitude')(e.target.value)} placeholder="e.g. 78.4867" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:border-violet-500 transition-all"/>
                          </div>
                          <button type="button" onClick={detectGeo} disabled={loading} className="h-[52px] bg-white border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-50 transition-all">
                            <MapPin size={13} className="text-violet-600"/>Auto
                          </button>
                        </div>

                        <div className="border border-slate-200 rounded-2xl p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-slate-800">Multiple Branches</p>
                              <p className="text-[10px] text-slate-400">Configure additional branch locations?</p>
                            </div>
                            <button type="button" onClick={() => { setHasBranches(!hasBranches); if (hasBranches) { set('branches')(''); setBranchAddresses({}); } }}
                              className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${hasBranches ? 'bg-violet-600' : 'bg-slate-200'}`}>
                              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${hasBranches ? 'left-5.5' : 'left-0.5'}`}/>
                            </button>
                          </div>
                          {hasBranches && (
                            <div className="space-y-4 pt-2 border-t border-slate-100">
                              <div>
                                <label className="block text-slate-700 text-[11px] font-semibold mb-1.5">Branch Names <span className="text-slate-400">(comma separated)</span></label>
                                <input type="text" value={f.branches} onChange={e => set('branches')(e.target.value)} placeholder="e.g. Gachibowli, Kukatpally"
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:bg-white focus:border-violet-500 transition-all"/>
                              </div>
                              {branchList.length > 0 && (
                                <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl space-y-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 flex items-center gap-1.5"><MapPin size={11}/>Branch Addresses</p>
                                  {branchList.map(b => (
                                    <div key={b}>
                                      <label className="text-[10px] font-bold text-violet-700 block mb-1">"{b}" full address</label>
                                      <input value={branchAddresses[b]||''} onChange={e => setBranchAddresses(p => ({...p,[b]:e.target.value}))} placeholder="Full address for branch..."
                                        className="w-full bg-white border border-violet-200 rounded-xl p-3 text-xs outline-none focus:border-violet-500 transition-all"/>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <button type="button" onClick={submitStep1} disabled={loading || !s1Valid}
                        className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-violet-200 flex items-center justify-center gap-2">
                        {loading ? <><RefreshCw size={15} className="animate-spin"/>Saving…</> : 'Continue to Documents →'}
                      </button>
                    </motion.div>
                  )}

                  {/* ═══ STEP 2 — Documents ════════════════════════════════════ */}
                  {step === 2 && (
                    <motion.div key="s2" initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-12 }} className="space-y-6">
                      <div>
                        <h4 className="text-xl font-black text-slate-900">Upload Documents</h4>
                        <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                          All documents are optional here — you can skip and our team will contact you if anything is needed.
                          We review every document manually before activating your hospital.
                        </p>
                      </div>

                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 mb-1">📋 What we verify</p>
                        <p className="text-[10px] text-blue-600 leading-relaxed">
                          PAN card (director/owner), hospital license or NABH certificate, and a recent photo of
                          the authorized signatory. Wrong documents won't reject your application — our team will
                          reach out to clarify.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <DocUpload label="Director / Owner Photo" hint="Clear selfie or headshot (JPG, PNG)" icon={Camera} file={docPhoto} onFile={setDocPhoto} accept="image/*"/>
                        <DocUpload label="PAN Card" hint="Photo or scan of director's PAN card (JPG, PNG, PDF)" icon={CreditCard} file={docPan} onFile={setDocPan} accept="image/*,.pdf"/>
                        <DocUpload label="Hospital License / NABH Certificate" hint="Scanned certificate or registration document (JPG, PNG, PDF)" icon={FileText} file={docLicense} onFile={setDocLicense} accept="image/*,.pdf"/>
                      </div>

                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setStep(1); setGlobalErr(''); }}
                          className="px-6 py-4 border border-slate-200 text-slate-600 font-bold text-sm rounded-2xl hover:bg-slate-50 transition-all">
                          ← Back
                        </button>
                        <button type="button" onClick={submitStep2} disabled={loading}
                          className="flex-1 py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                          {loading ? <><RefreshCw size={15} className="animate-spin"/>Uploading & Sending OTP…</> :
                            (docPhoto || docPan || docLicense)
                              ? 'Upload Documents & Send OTP →'
                              : 'Skip Documents & Send OTP →'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ═══ STEP 3 — Phone OTP Verification ═══════════════════════ */}
                  {step === 3 && (
                    <motion.div key="s3" initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-12 }} className="space-y-6">
                      <div>
                        <h4 className="text-xl font-black text-slate-900">Verify Your Identity</h4>
                        <p className="text-slate-400 text-xs mt-1">We've sent a 6-digit verification code to your phone.</p>
                      </div>

                      {simOtp && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                          <p className="text-[10px] uppercase font-bold tracking-widest text-amber-800">Dev Mode — Simulated OTP:</p>
                          <p className="text-xs font-bold text-amber-700">Phone OTP: <span className="font-mono text-base ml-2 tracking-widest bg-amber-100/60 px-2 py-0.5 rounded">{simOtp}</span></p>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label className="block text-slate-700 text-[11px] font-semibold mb-2">
                            Phone OTP — sent to {f.phone_number} <span className="text-rose-500">*</span>
                          </label>
                          <input type="text" value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g,'').slice(0,6)); setGlobalErr(''); }}
                            placeholder="● ● ● ● ● ●" inputMode="numeric" maxLength={6}
                            className={`w-full border rounded-xl p-4 text-center text-2xl font-black tracking-[0.7em] font-mono outline-none transition-all ${
                              otp.length===6 ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-violet-500'
                            }`}
                          />
                          {otp && otp.length < 6 && <p className="mt-1.5 text-[10px] font-bold text-amber-600">{otp.length}/6 digits entered</p>}
                        </div>

                        <p className="text-[10px] text-slate-400 text-center">
                          Didn't receive it?{' '}
                          <button type="button" onClick={submitStep2} disabled={loading} className="text-violet-600 font-bold hover:underline disabled:opacity-50">
                            Resend OTP
                          </button>
                        </p>

                        <div className="flex gap-3">
                          <button type="button" onClick={() => { setStep(2); setGlobalErr(''); }}
                            className="px-6 py-4 border border-slate-200 text-slate-600 font-bold text-sm rounded-2xl hover:bg-slate-50 transition-all">
                            ← Back
                          </button>
                          <button type="button" onClick={verifyOtp} disabled={loading || otp.length < 6}
                            className="flex-1 py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                            {loading ? 'Verifying…' : 'Verify & Submit Application →'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ═══ STEP 4 — Application Submitted ═══════════════════════ */}
                  {step === 4 && (
                    <motion.div key="s4" initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} className="text-center space-y-6 py-8">
                      <div className="w-20 h-20 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center mx-auto">
                        <Clock size={36} className="text-amber-500"/>
                      </div>
                      <h4 className="text-2xl font-black text-slate-900">Application Submitted</h4>
                      <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                        <strong className="text-slate-800">{f.name}</strong> is now under review by our verification team.
                        You'll receive an SMS and email once your hospital is approved — typically within 24 hours.
                      </p>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-2 max-w-sm mx-auto">
                        <div className="flex justify-between text-xs"><span className="text-slate-400 font-medium">Status</span><span className="font-black text-amber-600 uppercase">Pending Verification</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-400 font-medium">Hospital ID</span><span className="font-mono text-slate-600">{hospitalId?.slice(0,8)}…</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-400 font-medium">Documents</span>
                          <span className="font-bold text-slate-600">
                            {[docPhoto&&'Photo', docPan&&'PAN', docLicense&&'License'].filter(Boolean).join(', ') || 'None (team will follow up)'}
                          </span>
                        </div>
                      </div>
                      <button type="button" onClick={handleClose}
                        className="w-full max-w-sm mx-auto py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl transition-all shadow-lg block">
                        Close
                      </button>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
