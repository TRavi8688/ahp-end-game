import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, FileText, Globe, Phone, Mail, FileCheck, ShieldAlert, Clock, Building2, MapPin, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function VerificationDetail({ hospitalId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [hospitalId]);

  const fetchDetail = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/admin/verification/${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch detail', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAction = (type) => {
    setModalType(type);
    setActionNotes("");
    setShowModal(true);
  };

  const handleSubmitAction = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      if (modalType === 'approve') {
        await axios.post(`${API_BASE}/admin/verification/${hospitalId}/approve`, { notes: actionNotes }, config);
      } else if (modalType === 'reject') {
        await axios.post(`${API_BASE}/admin/verification/${hospitalId}/reject`, { notes: actionNotes }, config);
      } else if (modalType === 'request_info') {
        await axios.post(`${API_BASE}/admin/verification/${hospitalId}/request-more-info`, { missing_items: [], custom_message: actionNotes }, config);
      }
      
      setShowModal(false);
      onBack(); // Return to queue after action
    } catch (err) {
      console.error('Action failed', err);
      alert('Failed to process verification action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col h-full bg-slate-50 items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
        <p className="text-slate-500 font-medium">Loading Crypto-Evidence Vault...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{data.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Building2 size={14} /> {data.type}</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1"><MapPin size={14} /> Sunnyvale, CA</span>
              <span className="text-slate-300">•</span>
              <span className="text-blue-600 font-medium">Status: Under Review</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Score</div>
            <div className={`font-medium text-sm ${data.risk_score > 60 ? 'text-red-600' : 'text-emerald-600'}`}>
               {data.risk_score > 60 ? 'High Risk' : 'Low Risk'}
            </div>
          </div>
          <div className={`text-3xl font-bold border-l border-slate-200 pl-4 ${data.risk_score > 60 ? 'text-red-600' : 'text-emerald-600'}`}>
            {data.risk_score || 0}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 max-w-[1400px] mx-auto">
          
          {/* Left/Center Workspace (3 columns) */}
          <div className="xl:col-span-3 space-y-8">
            
            {/* Identity & Contact */}
            <section className="enterprise-card p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-6 border-b border-slate-100 pb-4">Organizational Identity</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <span className="enterprise-label">Primary Domain</span>
                  <div className="text-sm font-medium text-slate-900 flex items-center gap-2"><Globe size={16} className="text-slate-400"/> {data.domain || 'N/A'}</div>
                </div>
                <div>
                  <span className="enterprise-label">Government ID (GST)</span>
                  <div className="text-sm font-mono font-medium text-slate-900">{data.gst_number || 'N/A'}</div>
                </div>
                <div>
                  <span className="enterprise-label">Registered Address</span>
                  <div className="text-sm text-slate-700">See documents vault</div>
                </div>
                <div>
                  <span className="enterprise-label">Admin Email</span>
                  <div className="text-sm text-slate-700 flex items-center gap-2"><Mail size={16} className="text-slate-400"/> {data.hospital_email}</div>
                </div>
                <div>
                  <span className="enterprise-label">Contact Number</span>
                  <div className="text-sm text-slate-700 flex items-center gap-2"><Phone size={16} className="text-slate-400"/> {data.hospital_phone}</div>
                </div>
              </div>
            </section>

            {/* Document Intelligence */}
            <section className="enterprise-card p-6">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-semibold text-slate-900">Cryptographic Evidence</h2>
                <span className="text-sm text-slate-500">2 Documents Uploaded</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.documents.map(doc => (
                  <div key={doc.id} className="flex items-start justify-between p-4 border border-slate-200 rounded-lg bg-slate-50 hover:border-slate-300 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded border border-slate-200 text-blue-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{doc.type}</div>
                        <div className="text-xs text-slate-500 mt-1">Category: {doc.category} • Uploaded {doc.date}</div>
                        <div className="mt-2">
                           <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                              doc.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {doc.status}
                            </span>
                        </div>
                      </div>
                    </div>
                    <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">View File</button>
                  </div>
                ))}
              </div>
            </section>
            
            {/* Fraud Signals */}
            {data.fraud_signals && data.fraud_signals.length > 0 && (
              <section className="enterprise-card p-6 border-l-4 border-l-amber-500">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <ShieldAlert className="text-amber-500" size={20} /> 
                  Automated Threat Intelligence
                </h2>
                <ul className="space-y-3">
                  {data.fraud_signals.map((sig, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700 bg-amber-50/50 p-3 rounded-md border border-amber-100">
                      <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                      {sig.signal_type}: {sig.description}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Right Action Panel */}
          <div className="xl:col-span-1">
            <div className="enterprise-card p-6 sticky top-0">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Verification Actions</h3>
              
              <div className="space-y-3">
                <button onClick={() => handleOpenAction('approve')} className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-md font-medium hover:bg-slate-800 transition-colors shadow-sm">
                  <CheckCircle size={18} />
                  Approve Registration
                </button>
                
                <button onClick={() => handleOpenAction('request_info')} className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-3 rounded-md font-medium hover:bg-slate-50 transition-colors shadow-sm">
                  <AlertTriangle size={18} />
                  Request More Info
                </button>
                
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <button onClick={() => handleOpenAction('reject')} className="w-full flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-3 rounded-md font-medium hover:bg-red-50 transition-colors">
                    <XCircle size={18} />
                    Reject / Blacklist
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {modalType === 'approve' ? 'Approve Hospital Registration' : modalType === 'reject' ? 'Reject Application' : 'Request Additional Information'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {modalType === 'request_info' && (
                <div className="space-y-6">
                  <div>
                    <label className="enterprise-label">Additional Instructions</label>
                    <textarea 
                      className="enterprise-input h-24 resize-none w-full p-2 border border-slate-200 rounded-md" 
                      placeholder="Enter a message to be sent to the hospital administrator..."
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                    ></textarea>
                  </div>
                </div>
              )}
              {modalType === 'approve' && (
                 <div className="space-y-4">
                   <p className="text-sm text-slate-600">Are you sure you want to approve this hospital? This will instantly grant them access to the Hospyn network.</p>
                   <textarea 
                     className="enterprise-input w-full p-2 border border-slate-200 rounded-md text-sm" 
                     placeholder="Approval notes (optional)"
                     value={actionNotes}
                     onChange={(e) => setActionNotes(e.target.value)}
                   ></textarea>
                 </div>
              )}
              {modalType === 'reject' && (
                 <div className="space-y-4">
                   <p className="text-sm text-slate-600">Are you sure you want to reject this application? You can optionally add this hospital to the blacklist registry.</p>
                   <textarea 
                     className="enterprise-input w-full p-2 border border-slate-200 rounded-md text-sm" 
                     placeholder="Reason for rejection (Required)"
                     value={actionNotes}
                     onChange={(e) => setActionNotes(e.target.value)}
                   ></textarea>
                 </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button onClick={() => setShowModal(false)} disabled={isSubmitting} className="enterprise-btn-secondary disabled:opacity-50">Cancel</button>
              <button 
                onClick={handleSubmitAction} 
                disabled={isSubmitting || (modalType === 'reject' && !actionNotes)}
                className={`enterprise-btn-primary flex items-center gap-2 ${modalType === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''} disabled:opacity-50`}
              >
                {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
