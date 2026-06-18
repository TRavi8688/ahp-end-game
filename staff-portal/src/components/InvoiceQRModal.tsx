import React, { useState, useEffect } from 'react';
import { QrCode, ShieldCheck, X, RefreshCw, CreditCard } from 'lucide-react';
import apiClient from '../apiClient';

interface InvoiceQRModalProps {
  invoice: {
    id: string;
    invoice_number: string;
    payable_amount: number;
    patient_id?: string;
  };
  onClose: () => void;
}

export default function InvoiceQRModal({ invoice, onClose }: InvoiceQRModalProps) {
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txnRef, setTxnRef] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (invoice) {
      fetchQR();
    }
  }, [invoice]);

  const fetchQR = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/billing/invoice/${invoice.id}/upi-qr`);
      setQrBase64(res.data.data.qr_base64);
    } catch (err: any) {
      console.error('Failed to fetch UPI QR:', err);
      setError(err.response?.data?.detail || 'Failed to generate QR Code. Make sure the hospital has a UPI VPA configured.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnRef.trim()) return;

    try {
      setVerifying(true);
      await apiClient.patch(`/billing/invoice/${invoice.id}/mark-paid`, {
        payment_method: 'UPI',
        upi_transaction_ref: txnRef
      });
      alert('Payment verified and invoice marked as PAID!');
      onClose();
    } catch (err) {
      alert('Failed to update invoice status.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0a0a0c] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <QrCode className="text-blue-500" size={20} />
            <h3 className="text-lg font-black outfit text-white uppercase tracking-tight">Scan Desk QR</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 text-center space-y-6">
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase mb-1">Invoice Amount</p>
            <p className="text-4xl font-black outfit text-blue-500">₹{(invoice.payable_amount / 100).toFixed(2)}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Invoice: {invoice.invoice_number}</p>
          </div>

          <div className="bg-white/[0.01] border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="text-blue-500 animate-spin" size={28} />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generating secure UPI QR...</span>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-bold tracking-wide">
                {error}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-2xl inline-block shadow-lg shadow-blue-500/5 border border-white/10">
                  <img 
                    src={`data:image/png;base64,${qrBase64}`} 
                    alt="UPI QR Code" 
                    className="w-[200px] h-[200px]"
                  />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Scan with GPay, PhonePe, Paytm or BHIM
                </p>
              </div>
            )}
          </div>

          {/* Verification Form */}
          {!loading && !error && (
            <form onSubmit={handleVerifyPayment} className="space-y-4 text-left border-t border-white/5 pt-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CreditCard size={12} className="text-blue-500" />
                  UPI Transaction ID / Ref Number
                </label>
                <input 
                  type="text" 
                  required
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  placeholder="e.g. 23849204928"
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              <button 
                type="submit"
                disabled={verifying}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-xl font-black text-[11px] tracking-widest uppercase transition-all shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2"
              >
                <ShieldCheck size={16} />
                {verifying ? 'Verifying...' : 'Verify & Mark Paid'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
