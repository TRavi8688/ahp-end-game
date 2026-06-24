// NOTE: superseded, no longer routed — see App.jsx. Replaced by
// src/pages/more/MoreSettings.jsx (same QR code + account info, plus the
// printer/notification toggles and staff-roles link the 32-screen spec
// asked for). Kept per your no-file-loss instruction.
import React, { useState, useEffect } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { User, Mail, ShieldCheck, LogOut } from 'lucide-react';
import apiClient from '../services/apiClient';

export default function Profile({ onLogout }) {
  const [me, setMe] = useState(null);

  useEffect(() => {
    apiClient.get('/auth/me').then((res) => setMe(res.data)).catch(() => {});
  }, []);

  // EXECUTION FIX (carried over from the dashboard rebuild): this used to read
  // localStorage's 'token' key directly here too, which is fine — the real
  // bug was the key mismatch with Login.jsx, already fixed app-wide.
  const token = localStorage.getItem('token');
  let pharmacyId = 'UNKNOWN_PHARMACY';
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      pharmacyId = payload.hospital_id || payload.sub;
    } catch {}
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-ink-900 mb-4">Profile</h1>

      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-ink-900">{me?.role ? me.role.charAt(0).toUpperCase() + me.role.slice(1) : 'Pharmacy Partner'}</p>
            <p className="text-xs text-gray-400">{me?.user_id?.slice(0, 8) || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 py-1.5">
          <ShieldCheck className="w-4 h-4 text-success-600" /> Account active
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-card p-5 mb-4 text-center">
        <p className="font-bold text-ink-900 mb-1">Universal Receiving QR</p>
        <p className="text-xs text-gray-500 mb-4">
          Display this at the counter. Patients scan it with their HOSPAIN app to instantly share prescriptions.
        </p>
        <div className="bg-white border border-lavender-100 rounded-2xl p-4 inline-block">
          <QRCode value={pharmacyId} size={160} fgColor="#0F1029" bgColor="#ffffff" />
        </div>
      </div>

      <button
        onClick={onLogout}
        className="w-full bg-white hover:bg-red-50 text-red-600 font-semibold py-3.5 rounded-2xl shadow-card flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-4 h-4" /> Log Out
      </button>
    </div>
  );
}
