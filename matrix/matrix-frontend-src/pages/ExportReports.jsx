// super-admin-dashboard/src/pages/ExportReports.jsx
// PHASE H – New page: Export hospital list (CSV), revenue (PDF via jsPDF), users (Excel via SheetJS)
// Install: npm install jspdf jspdf-autotable xlsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import apiClient from '../services/apiClient';

/* ── API fetchers ── */
const fetchHospitals  = () => apiClient.get('/api/v1/hospitals?limit=500').then(r => r.data?.data || r.data?.hospitals || r.data || []);
const fetchRevenue    = () => apiClient.get(`/api/v1/admin/revenue?period=monthly&year=${new Date().getFullYear()}`).then(r => r.data);
const fetchUsers      = () => apiClient.get('/api/v1/admin/users?limit=500').then(r => r.data?.users || r.data || []);

/* ── CSV helper ── */
function toCSV(rows, headers) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines  = [headers.map(escape).join(',')];
  rows.forEach(row => lines.push(headers.map(h => escape(row[h] ?? '')).join(',')));
  return lines.join('\n');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Export card ── */
function ExportCard({ icon, title, description, format, color, onExport, loading }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4">
      <div className={`p-3 rounded-xl w-fit bg-${color}-500/10`}>
        <div className={`text-${color}-400`}>{icon}</div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="flex items-center justify-between mt-auto">
        <span className={`badge badge-${color === 'emerald' ? 'green' : color === 'rose' ? 'red' : 'blue'} text-xs uppercase`}>{format}</span>
        <button
          onClick={onExport}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-${color}-500/15 text-${color}-400 border border-${color}-500/25 hover:bg-${color}-500/25 transition-colors`}
        >
          {loading
            ? <><Loader2 size={13} className="animate-spin" />Exporting…</>
            : <><Download size={13} />Export</>}
        </button>
      </div>
    </div>
  );
}

export default function ExportReports() {
  const [status, setStatus] = useState({});

  const hospitalsQ = useQuery({ queryKey: ['export-hospitals'], queryFn: fetchHospitals, enabled: false });
  const revenueQ   = useQuery({ queryKey: ['export-revenue'],   queryFn: fetchRevenue,   enabled: false });
  const usersQ     = useQuery({ queryKey: ['export-users'],     queryFn: fetchUsers,     enabled: false });

  const setLoading = (key, val) => setStatus(s => ({ ...s, [key]: val }));

  /* ── 1. Hospital list → CSV ── */
  const exportHospitalsCSV = async () => {
    setLoading('hospitals', true);
    try {
      const data = await hospitalsQ.refetch().then(r => r.data || []);
      const headers = ['id', 'name', 'short_code', 'status', 'city', 'state', 'contact_email', 'created_at'];
      const csv  = toCSV(data, headers);
      downloadBlob(new Blob([csv], { type: 'text/csv' }), `hospitals-${Date.now()}.csv`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading('hospitals', false);
    }
  };

  /* ── 2. Revenue report → PDF via jsPDF ── */
  const exportRevenuePDF = async () => {
    setLoading('revenue', true);
    try {
      const [{ jsPDF }, autoTable] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const rev     = await revenueQ.refetch().then(r => r.data || {});
      const ledger  = rev.transactions || rev.ledger || [];
      const summary = rev.summary || {};

      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text('Revenue Report', 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 30);

      // Summary block
      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text('Summary', 14, 42);
      autoTable.default(doc, {
        startY: 46,
        head: [['Metric', 'Value']],
        body: [
          ['Total Revenue',    `₹${(summary.total_revenue ?? 0).toLocaleString()}`],
          ['Consultation',     `₹${(summary.consultation_revenue ?? 0).toLocaleString()}`],
          ['Pharmacy',         `₹${(summary.pharmacy_revenue ?? 0).toLocaleString()}`],
          ['Lab Services',     `₹${(summary.lab_revenue ?? 0).toLocaleString()}`],
          ['Transactions',     ledger.length],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [99, 102, 241] },
      });

      // Ledger table
      if (ledger.length > 0) {
        doc.text('Transactions', 14, doc.lastAutoTable.finalY + 12);
        autoTable.default(doc, {
          startY: doc.lastAutoTable.finalY + 16,
          head: [['Invoice', 'Patient', 'Amount', 'Method', 'Date']],
          body: ledger.slice(0, 200).map(l => [
            l.invoice_number || l.id?.substring(0, 10),
            l.patient_name || '—',
            `₹${(l.total_amount || l.amount || 0).toLocaleString()}`,
            l.payment_method || '—',
            l.date || l.created_at ? new Date(l.date || l.created_at).toLocaleDateString() : '—',
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [99, 102, 241] },
        });
      }

      doc.save(`revenue-report-${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading('revenue', false);
    }
  };

  /* ── 3. User list → Excel via SheetJS ── */
  const exportUsersExcel = async () => {
    setLoading('users', true);
    try {
      const XLSX = await import('xlsx');
      const data = await usersQ.refetch().then(r => r.data || []);

      const rows = data.map(u => ({
        ID:          u.id,
        Name:        u.name || u.full_name,
        Email:       u.email,
        Phone:       u.phone,
        Role:        u.role,
        Hospital:    u.hospital_name || u.hospital_id || '—',
        Status:      u.status || u.account_status,
        MFA_Enabled: u.mfa_enabled ? 'Yes' : 'No',
        Created:     u.created_at ? new Date(u.created_at).toLocaleDateString() : '—',
        Last_Login:  u.last_login  ? new Date(u.last_login).toLocaleDateString()  : '—',
      }));

      const ws  = XLSX.utils.json_to_sheet(rows);
      const wb  = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Users');

      // Auto column widths
      const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `users-export-${Date.now()}.xlsx`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading('users', false);
    }
  };

  const reports = [
    {
      key:  'hospitals',
      icon: <FileSpreadsheet size={24} />,
      title: 'Hospital Network Export',
      description: 'Full list of all registered hospitals with status, location, and contact info.',
      format: 'CSV',
      color: 'emerald',
      onExport: exportHospitalsCSV,
    },
    {
      key: 'revenue',
      icon: <FileText size={24} />,
      title: 'Revenue Report',
      description: 'Monthly revenue breakdown with full transaction ledger across all hospitals.',
      format: 'PDF',
      color: 'indigo',
      onExport: exportRevenuePDF,
    },
    {
      key: 'users',
      icon: <FileSpreadsheet size={24} />,
      title: 'User / IAM Export',
      description: 'All system users with role, hospital, MFA status, and last login date.',
      format: 'XLSX',
      color: 'amber',
      onExport: exportUsersExcel,
    },
  ];

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Download size={20} className="text-indigo-400" />
          Export Reports
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Download platform data as CSV, PDF, or Excel</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-5">
          {reports.map(r => (
            <ExportCard
              key={r.key}
              {...r}
              loading={status[r.key]}
            />
          ))}
        </div>

        {/* Info note */}
        <div className="mt-6 glass-card p-4 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400">
            Exports are generated on-demand from the live API. Large datasets (1000+ rows) may take a few seconds.
            PDF reports use <span className="text-slate-300 font-medium">jsPDF</span> and require{' '}
            <span className="font-mono text-slate-300">npm install jspdf jspdf-autotable</span>.{' '}
            Excel exports use <span className="text-slate-300 font-medium">SheetJS</span> —{' '}
            <span className="font-mono text-slate-300">npm install xlsx</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
