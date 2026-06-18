import React, { useState, useEffect } from 'react';
import { CreditCard, Search, Coins, RefreshCw, Printer, AlertCircle, QrCode } from 'lucide-react';
import apiClient from '../../apiClient';
import InvoiceQRModal from '../../components/InvoiceQRModal';

interface Invoice {
  id: string;
  invoice_number: string;
  patient_id?: string;
  appointment_id?: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  payable_amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  upi_transaction_ref?: string;
  created_at: string;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/billing/hospital/invoices');
      setInvoices(res.data.data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleMarkPaidCash = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to mark this invoice as paid via CASH?')) return;
    try {
      setProcessingId(invoiceId);
      await apiClient.patch(`/billing/invoice/${invoiceId}/mark-paid`, {
        upi_transaction_ref: 'CASH-DESK'
      });
      alert('Invoice marked as Paid via Cash!');
      fetchInvoices();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update invoice.');
    } finally {
      setProcessingId(null);
    }
  };

  const printReceipt = (inv: Invoice) => {
    // Open a blank print frame/window to print a formatted thermal receipt
    const printWindow = window.open('about:blank', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Thermal Receipt - ${inv.invoice_number}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.4; padding: 20px; color: #000; max-width: 300px; margin: 0 auto; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .header { margin-bottom: 15px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .total-row { font-size: 14px; font-weight: bold; margin-top: 8px; }
            .footer { text-align: center; margin-top: 25px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="text-center header">
            <div class="font-bold" style="font-size: 16px;">HOSPYN CLINICS</div>
            <div>OUTPATIENT BILLING RECEIPT</div>
          </div>
          <div class="divider"></div>
          <div class="row"><span>Invoice:</span><span class="font-bold">${inv.invoice_number}</span></div>
          <div class="row"><span>Date:</span><span>${new Date(inv.created_at).toLocaleDateString()}</span></div>
          <div class="row"><span>Status:</span><span class="font-bold">PAID</span></div>
          <div class="divider"></div>
          <div class="row"><span>Consultation Fee:</span><span>₹${(inv.total_amount / 100).toFixed(2)}</span></div>
          ${inv.discount_amount > 0 ? `<div class="row"><span>Discount:</span><span>-₹${(inv.discount_amount / 100).toFixed(2)}</span></div>` : ''}
          <div class="divider"></div>
          <div class="row total-row"><span>Total Paid:</span><span>₹${(inv.payable_amount / 100).toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="row"><span>Payment Mode:</span><span>${inv.upi_transaction_ref === 'CASH-DESK' ? 'CASH' : 'UPI'}</span></div>
          ${inv.upi_transaction_ref && inv.upi_transaction_ref !== 'CASH-DESK' ? `<div class="row" style="font-size: 9px;"><span>Txn Ref:</span><span>${inv.upi_transaction_ref}</span></div>` : ''}
          <div class="footer">
            <div>Thank you for visiting!</div>
            <div>Hospyn Clinix Infrastructure</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredInvoices = invoices.filter(inv => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return inv.invoice_number.toLowerCase().includes(query) || (inv.patient_id && inv.patient_id.includes(query));
  });

  // Stats
  const totalCount = invoices.length;
  const paidCount = invoices.filter(i => i.status === 'PAID').length;
  const unpaidCount = invoices.filter(i => i.status === 'PENDING').length;
  
  const revenueSum = invoices
    .filter(i => i.status === 'PAID')
    .reduce((sum, current) => sum + current.payable_amount, 0);

  const pendingSum = invoices
    .filter(i => i.status === 'PENDING')
    .reduce((sum, current) => sum + current.payable_amount, 0);

  return (
    <div className="min-h-screen p-6 md:p-10 bg-[#050508] text-[#f8fafc] font-inter overflow-x-hidden">
      
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.3em] uppercase text-emerald-500">
              Billing & Desk Checkout
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter outfit leading-none text-white">Billing Command Desk</h1>
          <p className="text-slate-500 text-sm font-medium">Manage hospital billing, invoices, and thermal receipts.</p>
        </div>
        <button 
          onClick={fetchInvoices} 
          className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white px-6 py-3.5 rounded-2xl font-bold text-[11px] tracking-wider uppercase transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Desk
        </button>
      </header>

      {/* Stats HUD */}
      <div className="grid grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Total Invoices', value: totalCount, sub: 'All bills', color: 'text-slate-400', bg: 'from-slate-500/5 to-transparent border-white/5' },
          { label: 'Paid Bills', value: paidCount, sub: `₹${(revenueSum / 100).toFixed(2)}`, color: 'text-emerald-500', bg: 'from-emerald-500/10 to-transparent border-emerald-500/10' },
          { label: 'Pending Bills', value: unpaidCount, sub: `₹${(pendingSum / 100).toFixed(2)}`, color: 'text-amber-500', bg: 'from-amber-500/10 to-transparent border-amber-500/10' },
          { label: 'Total Revenue', value: `₹${(revenueSum / 100).toFixed(2)}`, sub: 'Settled desk payments', color: 'text-blue-500', bg: 'from-blue-500/10 to-transparent border-blue-500/10' },
        ].map((stat, i) => (
          <div key={i} className={`bg-gradient-to-br ${stat.bg} bg-white/[0.02] border border-white/5 rounded-[28px] p-6 relative overflow-hidden transition-all hover:scale-[1.01]`}>
            <h2 className={`text-3xl font-black outfit tracking-tighter ${stat.color}`}>{stat.value}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
            <p className="text-[10px] font-bold text-slate-500 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Search */}
      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
          <Search className="text-slate-500" size={18} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter invoices by invoice ID or number..."
          className="w-full bg-white/[0.03] border border-white/5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-[20px] pl-14 pr-6 py-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
        />
      </div>

      {error && (
        <div className="p-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-3xl text-sm flex items-center gap-3 mb-8">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-24 text-center">
          <RefreshCw className="animate-spin text-emerald-500 mx-auto mb-4" size={36} />
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Loading invoice registry...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white/[0.01] border border-white/5 rounded-[32px] p-16 text-center text-slate-500">
          <CreditCard className="mx-auto mb-4 opacity-10 text-emerald-500" size={64} />
          <p className="text-sm font-bold uppercase tracking-widest">No invoices found in registry</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInvoices.map(inv => {
            const isPaid = inv.status === 'PAID';
            return (
              <div 
                key={inv.id} 
                className={`bg-white/[0.02] border rounded-[28px] p-6 flex flex-col justify-between transition-all hover:scale-[1.01] ${
                  isPaid ? 'border-emerald-500/10' : 'border-white/5'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-mono font-bold text-slate-400 bg-white/5 px-3 py-1 rounded-xl">
                      {inv.invoice_number}
                    </span>
                    <span className={`px-2.5 py-0.5 border rounded-[8px] text-[8px] font-black uppercase tracking-widest ${
                      isPaid 
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                    }`}>
                      {inv.status}
                    </span>
                  </div>

                  <div className="my-6">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Payable Balance</p>
                    <h3 className="text-3xl font-black outfit text-white">₹{(inv.payable_amount / 100).toFixed(2)}</h3>
                    {inv.discount_amount > 0 && (
                      <p className="text-[10px] font-bold text-rose-500/80 mt-1">
                        Discount of ₹{(inv.discount_amount / 100).toFixed(2)} Applied
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 border-t border-white/5 pt-4">
                    <p><strong>Patient ID:</strong> <span className="text-slate-400 font-mono text-[10px]">{inv.patient_id || 'Walk-in'}</span></p>
                    <p><strong>Date Issued:</strong> <span className="text-slate-400">{new Date(inv.created_at).toLocaleDateString()}</span></p>
                    {inv.upi_transaction_ref && (
                      <p>
                        <strong>Ref:</strong> <span className="text-slate-400 font-mono text-[10px]">{inv.upi_transaction_ref}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 mt-6 border-t border-white/5 pt-4">
                  {!isPaid ? (
                    <>
                      <button 
                        onClick={() => setSelectedInvoice(inv)}
                        className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/10"
                      >
                        <QrCode size={14} /> UPI QR
                      </button>
                      <button 
                        onClick={() => handleMarkPaidCash(inv.id)}
                        disabled={processingId === inv.id}
                        className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 font-bold text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-1.5"
                      >
                        <Coins size={14} className="text-amber-500" /> Cash
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => printReceipt(inv)}
                      className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-2"
                    >
                      <Printer size={14} className="text-blue-500" /> Print Thermal Receipt
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedInvoice && (
        <InvoiceQRModal 
          invoice={selectedInvoice} 
          onClose={() => {
            setSelectedInvoice(null);
            fetchInvoices();
          }} 
        />
      )}
    </div>
  );
}
