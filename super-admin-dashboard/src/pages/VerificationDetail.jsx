// super-admin-dashboard/src/pages/VerificationDetail.jsx
// FIXED:
//   1. Removed hospitalId prop + onBack prop — uses useParams() and useNavigate()
//   2. Removed localStorage.getItem('token') + raw axios — uses api from lib/apiClient

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle, AlertTriangle, XCircle, FileText,
  Phone, Mail, Clock, Building2, Loader2, Shield, X
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';

const InfoField = ({ label, value, mono }) => (
  <div>
    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">{label}</div>
    <div className={`text-sm text-slate-200 ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
  </div>
);

export default function VerificationDetail() {
  const { id: hospitalId } = useParams();
  const navigate = useNavigate();

  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!hospitalId) return;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/v1/admin/verification/${hospitalId}`);
        setData(res);
      } catch (e) {
        console.error('VerificationDetail fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [hospitalId]);

  const handleAction = async () => {
    setSubmitting(true);
    try {
      if (modalType === 'approve') {
        await api.post(`/api/v1/admin/verification/${hospitalId}/approve`, { notes: actionNotes });
      } else if (modalType === 'reject') {
        await api.post(`/api/v1/admin/verification/${hospitalId}/reject`, { notes: actionNotes });
      } else if (modalType === 'request_info') {
        await api.post(`/api/v1/admin/verification/${hospitalId}/request-more-info`, { missing_items: [], custom_message: actionNotes });
      }
      setShowModal(false);
      showToast(`Action "${modalType}" completed successfully`);
      setTimeout(() => navigate(-1), 1200);
    } catch (e) {
      showToast('Action failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data) return (
    <div className="h-full flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-indigo-500 mb-3" size={28} />
      <p className="text-slate-500 text-sm">Loading verification data...</p>
    </div>
  );

  const riskHigh = (data.risk_score || 0) > 60;

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl cursor-pointer ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
          <span className="text-sm font-semibold">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost py-2 px-2.5">
            <ArrowLeft size={15} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
            {(data.name || 'H').charAt(0)}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{data.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="badge badge-violet">{data.type || 'Hospital'}</span>
              <span className="badge badge-cyan">Under Review</span>
              {riskHigh
                ? <span className="badge badge-red"><AlertTriangle size={10} />High Risk</span>
                : <span className="badge badge-green">Low Risk</span>}
            </div>
          </div>
        </div>

        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${riskHigh ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Risk Score</div>
            <div className={`text-2xl font-black ${riskHigh ? 'text-rose-400' : 'text-emerald-400'}`}>{data.risk_score || 0}</div>
          </div>
          <Shield size={24} className={riskHigh ? 'text-rose-400' : 'text-emerald-400'} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-4 gap-5 max-w-6xl">
          <div className="col-span-3 space-y-5">
            {/* Identity */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                <Building2 size={14} className="text-amber-400" />Organizational Identity
              </h2>
              <div className="grid grid-cols-3 gap-5">
                <InfoField label="Hospital Name"     value={data.name} />
                <InfoField label="Primary Domain"    value={data.domain} />
                <InfoField label="GST / Govt ID"     value={data.gst_number} mono />
                <InfoField label="Admin Email"       value={data.hospital_email} />
                <InfoField label="Contact Number"    value={data.hospital_phone} />
                <InfoField label="Registration Date" value={data.created_at ? new Date(data.created_at).toLocaleDateString() : null} />
              </div>
            </div>

            {/* Documents */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText size={14} className="text-indigo-400" />Document Evidence Vault
                </h2>
                <span className="badge badge-blue">{(data.documents || []).length} documents</span>
              </div>
              {(data.documents || []).length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-sm">No documents uploaded</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(data.documents || []).map((doc, i) => (
                    <div key={doc.id || i} className="flex items-start justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400"><FileText size={16} /></div>
                        <div>
                          <div className="text-sm font-semibold text-white">{doc.type}</div>
                          <span className={`badge mt-1.5 ${doc.status === 'verified' ? 'badge-green' : 'badge-amber'}`}>{doc.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fraud Signals */}
            {(data.fraud_signals || []).length > 0 && (
              <div className="glass-card p-5 border-l-2 border-amber-500/50">
                <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <AlertTriangle size={14} />Threat Intelligence Signals
                </h2>
                <div className="space-y-2">
                  {(data.fraud_signals || []).map((sig, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/8 border border-amber-500/15">
                      <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-amber-300">{sig.signal_type}: </span>
                        <span className="text-xs text-amber-400/80">{sig.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Panel */}
          <div className="col-span-1">
            <div className="glass-card p-5 sticky top-0">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Verification Actions</h3>
              <div className="space-y-2">
                <button onClick={() => { setModalType('approve');      setActionNotes(''); setShowModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition-colors font-semibold text-sm">
                  <CheckCircle size={15} />Approve
                </button>
                <button onClick={() => { setModalType('request_info'); setActionNotes(''); setShowModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors font-semibold text-sm">
                  <AlertTriangle size={15} />Request Info
                </button>
                <div className="pt-2 mt-2 border-t border-white/5">
                  <button onClick={() => { setModalType('reject');     setActionNotes(''); setShowModal(true); }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors font-semibold text-sm">
                    <XCircle size={15} />Reject / Blacklist
                  </button>
                </div>
              </div>
              <div className="mt-5 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-1"><Clock size={11} /><span className="font-semibold uppercase tracking-wider">SLA Timer</span></div>
                <div className="text-sm font-bold text-amber-400">47h 12m remaining</div>
                <div className="progress-bar mt-2"><div className="progress-fill bg-amber-500" style={{ width: '35%' }} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content">
            <div className="p-5 border-b border-white/8 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {modalType === 'approve'      && <><CheckCircle size={16} className="text-emerald-400" />Approve Registration</>}
                {modalType === 'reject'       && <><XCircle size={16} className="text-rose-400" />Reject Application</>}
                {modalType === 'request_info' && <><AlertTriangle size={16} className="text-amber-400" />Request More Information</>}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {modalType === 'reject' ? 'Reason for Rejection *' : 'Notes (optional)'}
                </label>
                <textarea
                  rows={4}
                  className="input-dark resize-none text-sm"
                  placeholder={
                    modalType === 'approve'      ? 'Approval notes...' :
                    modalType === 'reject'       ? 'Provide a clear reason for rejection...' :
                    'List what documents or information are needed...'
                  }
                  value={actionNotes}
                  onChange={e => setActionNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/8 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
              <button
                onClick={handleAction}
                disabled={submitting || (modalType === 'reject' && !actionNotes.trim())}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors ${
                  modalType === 'approve'      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30' :
                  modalType === 'reject'       ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30' :
                  'bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
                }`}
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : (
                  modalType === 'approve' ? <CheckCircle size={15} /> :
                  modalType === 'reject'  ? <XCircle size={15} /> :
                  <AlertTriangle size={15} />
                )}
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
