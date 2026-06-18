// partner-app/src/pages/Scanner/Scanner.tsx
//
// BUG FIX: "Lookup Patient" button was disabled below 5 chars but had NO action.
// QR camera panel was pure decoration with no scanning library.
// Now wired to Redux scanQRCode → GET /api/v1/partner/inventory/scan?qr=...

import React, { useState } from 'react';
import { QrCode, Search, Scan, AlertCircle, Package, X, CheckCircle2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { scanQRCode, clearQRResult } from '../../store/inventorySlice';

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

const Scanner: React.FC = () => {
  const dispatch = useDispatch<any>();
  const { qrResult, qrLoading } = useSelector((s: any) => s.inventory);

  const [manualCode, setManualCode] = useState('');

  // BUG FIX: Button now actually does something.
  const handleLookup = () => {
    if (!manualCode.trim()) return;
    dispatch(scanQRCode(manualCode.trim()));
  };

  const handleClear = () => {
    dispatch(clearQRResult());
    setManualCode('');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Scan className="w-8 h-8 text-primary" />
          Scan Inventory QR
        </h1>
        <p className="text-slate-400 mt-2">
          Scan a medicine QR code or enter the SKU/QR string manually to look up inventory details.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Camera Panel (UI placeholder — expo-barcode-scanner handles native scan) */}
        <div className="glass-panel p-8 flex flex-col items-center justify-center relative overflow-hidden group min-h-[320px]">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5" />
          <div className="relative w-64 h-64 overflow-hidden rounded-2xl bg-slate-900/20 border border-white/10">
            <div className="absolute top-4 left-4  w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-xl" />
            <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-xl" />
            <div className="absolute bottom-4 left-4  w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-xl" />
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-xl" />
            <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_15px_rgba(59,130,246,0.8)] z-20"
              style={{ animation: 'scanLine 2.5s ease-in-out infinite' }} />
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <QrCode className="w-24 h-24 text-primary/20" />
            </div>
          </div>
          <p className="relative z-10 text-primary font-bold animate-pulse mt-6">
            Use the mobile app to scan
          </p>
          <p className="text-sm text-slate-400 mt-2 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> Camera scanning is available in the mobile app
          </p>
          <style>{`
            @keyframes scanLine {
              0%   { top: 0%;   opacity: 0; }
              10%  { opacity: 1; }
              90%  { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
          `}</style>
        </div>

        {/* Manual Entry */}
        <div className="glass-card p-8 flex flex-col justify-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
            <Search className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Manual QR / SKU Entry</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Enter the QR code string or SKU printed on the medicine packaging.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">QR Code / SKU</label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="e.g. MED-BATCH-2024-001"
                className="glass-input font-mono text-base"
              />
            </div>

            <button
              onClick={handleLookup}
              disabled={qrLoading || manualCode.trim().length < 3}
              className="w-full glass-button py-4 flex items-center justify-center gap-2 font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {qrLoading ? 'Looking up...' : 'Lookup Medicine'}
            </button>
          </div>

          {/* Result */}
          {qrResult && (
            <div className={`mt-6 rounded-xl p-4 border ${
              qrResult.found
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {qrResult.found
                    ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                    : <AlertCircle className="w-5 h-5 text-red-400" />
                  }
                  <span className={`font-semibold text-sm ${qrResult.found ? 'text-green-300' : 'text-red-300'}`}>
                    {qrResult.found ? 'Item Found' : 'Not Found'}
                  </span>
                </div>
                <button onClick={handleClear} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {qrResult.found && qrResult.item && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Name</span>
                    <span className="text-white font-semibold">{qrResult.item.item_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Stock</span>
                    <span className={`font-bold ${
                      qrResult.item.stock_quantity <= qrResult.item.reorder_level ? 'text-red-400' : 'text-green-400'
                    }`}>{qrResult.item.stock_quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Batch</span>
                    <span className="text-slate-300 font-mono text-xs">{qrResult.item.batch_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expiry</span>
                    <span className="text-slate-300">{qrResult.item.expiry_date?.slice(0, 10) || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">MRP</span>
                    <span className="text-white">{fmt(qrResult.item.mrp)}</span>
                  </div>
                  {qrResult.item.stock_quantity <= qrResult.item.reorder_level && (
                    <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-red-300 text-xs">Stock below reorder level — replenishment needed</span>
                    </div>
                  )}
                </div>
              )}

              {!qrResult.found && (
                <p className="text-red-300 text-sm">{qrResult.message}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scanner;
