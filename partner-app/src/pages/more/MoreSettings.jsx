import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { ChevronLeft, ShieldCheck, Printer, Bell, UserCog, LogOut } from 'lucide-react';
import apiClient from '../../services/apiClient';

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-primary-600' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function MoreSettings({ onLogout }) {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  // EXECUTION NOTE: printer/notification preferences have no backend model
  // anywhere in this codebase — these toggles are local-only (reset on
  // reload) rather than fabricating a persisted-settings API that doesn't
  // exist. Tell me what should be configurable and I'll add real storage.
  const [autoPrint, setAutoPrint] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState(true);

  useEffect(() => {
    apiClient.get('/auth/me').then((res) => setMe(res.data)).catch(() => {});
  }, []);

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
      <button onClick={() => navigate('/more')} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <h1 className="text-xl font-bold text-ink-900 mb-4">Settings</h1>

      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <p className="font-bold text-ink-900 mb-1">{me?.role ? me.role.charAt(0).toUpperCase() + me.role.slice(1) : 'Pharmacy Partner'}</p>
        <p className="text-xs text-gray-400 mb-2">{me?.user_id?.slice(0, 8) || '—'}</p>
        <div className="flex items-center gap-2 text-sm text-gray-600"><ShieldCheck className="w-4 h-4 text-success-600" /> Account active</div>
      </div>

      <div className="bg-white rounded-3xl shadow-card p-5 mb-4 text-center">
        <p className="font-bold text-ink-900 mb-1">Universal Receiving QR</p>
        <p className="text-xs text-gray-500 mb-4">Display this at the counter. Patients scan it with their HOSPAIN app to instantly share prescriptions.</p>
        <div className="bg-white border border-lavender-100 rounded-2xl p-4 inline-block">
          <QRCode value={pharmacyId} size={150} fgColor="#0F1029" bgColor="#ffffff" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card divide-y divide-lavender-50 mb-4">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3"><Printer className="w-4.5 h-4.5 text-gray-400" /><span className="text-sm font-medium text-ink-900">Auto-print bills</span></div>
          <Toggle checked={autoPrint} onChange={setAutoPrint} />
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3"><Bell className="w-4.5 h-4.5 text-gray-400" /><span className="text-sm font-medium text-ink-900">Low stock alerts</span></div>
          <Toggle checked={lowStockAlerts} onChange={setLowStockAlerts} />
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3"><Bell className="w-4.5 h-4.5 text-gray-400" /><span className="text-sm font-medium text-ink-900">New order alerts</span></div>
          <Toggle checked={orderAlerts} onChange={setOrderAlerts} />
        </div>
      </div>

      <button onClick={() => navigate('/more/staff')} className="w-full bg-white rounded-2xl shadow-card p-4 flex items-center gap-3 mb-4">
        <UserCog className="w-4.5 h-4.5 text-gray-400" /> <span className="text-sm font-medium text-ink-900">User Roles & Permissions</span>
      </button>

      <button onClick={onLogout} className="w-full bg-white hover:bg-red-50 text-red-600 font-semibold py-3.5 rounded-2xl shadow-card flex items-center justify-center gap-2 transition-colors">
        <LogOut className="w-4 h-4" /> Log Out
      </button>
    </div>
  );
}
