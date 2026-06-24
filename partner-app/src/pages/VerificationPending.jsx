import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import apiClient from '../services/apiClient';
import Logo from '../components/Logo';

function ChecklistRow({ title, subtitle, status }) {
  return (
    <div className="flex items-start gap-3 py-4 border-b border-lavender-100 last:border-0">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          status === 'done' ? 'bg-success-100' : 'bg-lavender-100'
        }`}
      >
        {status === 'done' ? (
          <Check className="w-5 h-5 text-success-600" />
        ) : (
          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
        )}
      </div>
      <div>
        <p className="font-semibold text-ink-900">{title}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function VerificationPending() {
  const location = useLocation();
  const navigate = useNavigate();
  const hospitalId = location.state?.hospitalId;

  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!hospitalId) return;
    setChecking(true);
    try {
      // EXECUTION: real polling against GET /onboarding/hospital-status/{id}
      const res = await apiClient.get(`/onboarding/hospital-status/${hospitalId}`);
      setStatus(res.data);
      if (res.data.is_approved) {
        setTimeout(() => navigate('/login'), 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(false);
    }
  }, [hospitalId, navigate]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-100 via-lavender-50 to-lavender-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <Logo variant="mark" className="w-9 h-9 rounded-xl" />
          <span className="font-bold text-ink-900 text-lg">HOSPAIN Partner</span>
        </div>

        <h2 className="text-2xl font-bold text-ink-900 mb-2">Verification Pending</h2>
        <p className="text-gray-500 text-sm mb-6">
          Your partner profile is currently undergoing verification. We'll notify you once each step is complete.
        </p>

        <div className="bg-white rounded-3xl shadow-card px-5">
          <ChecklistRow title="Account Details Submitted" status="done" />
          <ChecklistRow title="PAN Verification Completed" status="done" />
          <ChecklistRow
            title="Gov Medical License Audit"
            subtitle={status?.is_approved ? 'Approved — redirecting you to sign in...' : 'Our team is reviewing your documents.'}
            status={status?.is_approved ? 'done' : 'pending'}
          />
        </div>

        <button
          onClick={checkStatus}
          disabled={checking || !hospitalId}
          className="w-full text-center text-primary-600 font-semibold text-sm mt-6 py-2 disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Check Again Later'}
        </button>
      </div>
    </div>
  );
}
