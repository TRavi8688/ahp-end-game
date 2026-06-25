import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FlaskConical, Upload, CheckCircle, Clock,
  AlertCircle, Plus, X, Loader2, RefreshCw,
  Beaker, Activity,
} from 'lucide-react';
import apiClient from '../../apiClient';

interface LabOrder {
  id: string;
  patient_name?: string;
  patient_id?: string;
  doctor_name?: string;
  status: string;
  tests: Array<string | { name: string }>;
  created_at?: string;
}

interface ResultRow {
  test_name: string;
  value: string;
  unit: string;
  reference_range: string;
  is_abnormal: boolean;
  clinical_remarks: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: React.FC<any> }> = {
  pending:          { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',  label: 'Pending',         icon: Clock },
  sample_collected: { color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20', label: 'Sample Collected', icon: FlaskConical },
  processing:       { color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',    label: 'In Progress',      icon: Loader2 },
  completed:        { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',label: 'Completed',        icon: CheckCircle },
  cancelled:        { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',    label: 'Cancelled',        icon: AlertCircle },
};

const EMPTY_ROW: ResultRow = { test_name: '', value: '', unit: '', reference_range: '', is_abnormal: false, clinical_remarks: '' };

// FIXED: replaced undefined glass-panel CSS class with explicit Tailwind
const panel = 'bg-white/[0.02] border border-white/5 rounded-3xl';

// ── Result Entry Modal ────────────────────────────────────────────────────────
const ResultEntryModal: React.FC<{ order: LabOrder; onClose: () => void; onSuccess: () => void }> = ({ order, onClose, onSuccess }) => {
  const [resultRows, setResultRows]     = useState<ResultRow[]>([{ ...EMPTY_ROW }]);
  const [reportFile, setReportFile]     = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null); // FIXED: replaced alert()
  const [uploadError, setUploadError]   = useState<string | null>(null); // FIXED: replaced alert()
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addRow    = () => setResultRows(prev => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (idx: number) => setResultRows(prev => prev.filter((_, i) => i !== idx));
  const updateRow = (idx: number, field: keyof ResultRow, value: string | boolean) =>
    setResultRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReportFile(file);
    setUploadError(null);
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // FIXED: was /api/v1/lab/upload-report → /lab/upload-report
      const res = await apiClient.post('/lab/upload-report', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadedFileUrl(res.data.file_url);
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || 'Report upload failed. Please try again.');
    } finally { setUploadingFile(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const incomplete = resultRows.some(r => !r.test_name || !r.value);
    if (incomplete) { setSubmitError('Please fill in Test Name and Value for all rows.'); return; }
    setSubmitting(true);
    try {
      // FIXED: was /api/v1/lab/orders/... → /lab/orders/...
      await apiClient.post(`/lab/orders/${order.id}/results`, {
        results: resultRows,
        file_url: uploadedFileUrl || null,
      });
      onSuccess(); onClose();
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || 'Failed to submit results. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#0f172a] flex justify-between items-center p-8 border-b border-white/5 z-10">
          <div>
            <h2 className="text-xl font-black tracking-tight uppercase">Enter Results</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Order #{order.id.slice(0, 8).toUpperCase()} · {order.patient_name ?? `Patient #${order.patient_id?.slice(0, 8)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-white/5"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {submitError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-2 text-xs font-bold">
              <AlertCircle size={14} />{submitError}
            </div>
          )}

          {/* File Upload */}
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Upload Report PDF/Image (Optional)</p>
            {uploadError && <p className="text-xs text-rose-400 font-bold mb-2">{uploadError}</p>}
            <div onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all hover:border-blue-500/40 ${uploadedFileUrl ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
              {uploadingFile ? (
                <div className="flex items-center justify-center gap-3"><Loader2 size={20} className="animate-spin text-blue-500" /><p className="text-slate-400 text-sm font-bold">Uploading...</p></div>
              ) : uploadedFileUrl ? (
                <div className="flex items-center justify-center gap-3"><CheckCircle size={20} className="text-emerald-400" /><p className="text-emerald-400 text-sm font-bold">Uploaded — {reportFile?.name}</p></div>
              ) : (
                <><Upload size={28} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-500 text-sm font-medium">Click to upload PDF or Image report</p></>
              )}
            </div>
          </div>

          {/* Results Table */}
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Structured Test Results</p>
            <div className="overflow-x-auto border border-white/5 rounded-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900/40 border-b border-white/5">
                    {['Test Name *', 'Value *', 'Unit', 'Ref Range', 'Abn?', 'Remarks', ''].map(h => (
                      <th key={h} className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {resultRows.map((row, idx) => (
                    <tr key={idx}>
                      {(['test_name', 'value', 'unit', 'reference_range'] as const).map((f, fi) => (
                        <td key={f} className="px-2 py-2">
                          <input className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 min-w-[80px]"
                            placeholder={['CBC Panel','110','mg/dL','70-110'][fi]}
                            value={row[f]} onChange={e => updateRow(idx, f, e.target.value)} />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={row.is_abnormal} onChange={e => updateRow(idx, 'is_abnormal', e.target.checked)} className="w-4 h-4 accent-red-500 cursor-pointer" />
                      </td>
                      <td className="px-2 py-2">
                        <input className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 min-w-[100px]"
                          placeholder="Notes..." value={row.clinical_remarks} onChange={e => updateRow(idx, 'clinical_remarks', e.target.value)} />
                      </td>
                      <td className="px-2 py-2">
                        {resultRows.length > 1 && (
                          <button type="button" onClick={() => removeRow(idx)} className="p-1 text-red-500 hover:bg-red-500/10 rounded transition"><X size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addRow} className="flex items-center gap-2 mt-3 px-4 py-2 border border-dashed border-white/10 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-500/30 text-xs font-bold uppercase tracking-widest transition-all">
              <Plus size={12} /> Add Another Test Result
            </button>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-black uppercase tracking-wider transition-all">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Finalize & Push to Patient EHR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Lab Dashboard ────────────────────────────────────────────────────────
const LabDashboard: React.FC = () => {
  const [orders, setOrders]         = useState<LabOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [activeOrder, setActiveOrder] = useState<LabOrder | null>(null);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [collectError, setCollectError] = useState<string | null>(null); // FIXED: replaced alert()
  const [stats, setStats] = useState({ pending: '—', collected: '—', processing: '—', completed: '—' });
  const [showNewOrder, setShowNewOrder] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      // FIXED: was /api/v1/lab/orders → /lab/orders
      const res = await apiClient.get('/lab/orders', { params: { status: filterStatus } });
      const list: LabOrder[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setOrders(list);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }, [filterStatus]);

  const fetchStats = useCallback(async () => {
    try {
      const results = await Promise.allSettled(
        ['pending', 'sample_collected', 'processing', 'completed'].map(s =>
          apiClient.get('/lab/orders', { params: { status: s } })
        )
      );
      const extract = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? String(Array.isArray(r.value.data) ? r.value.data.length : (r.value.data?.data?.length ?? 0)) : '—';
      setStats({ pending: extract(results[0]), collected: extract(results[1]), processing: extract(results[2]), completed: extract(results[3]) });
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleMarkCollected = async (orderId: string) => {
    setCollectError(null);
    setCollecting(orderId);
    try {
      await apiClient.post(`/lab/orders/${orderId}/results`, {
        results: [{ test_name: 'Sample Collection', value: 'Collected', unit: '', reference_range: '', is_abnormal: false, clinical_remarks: 'Sample collected — awaiting processing.' }],
        file_url: null,
      });
      await fetchOrders();
      await fetchStats();
    } catch (err: any) {
      setCollectError(err.response?.data?.detail || 'Status update failed. The order may already be processing.');
      setTimeout(() => setCollectError(null), 4000);
    } finally { setCollecting(null); }
  };

  return (
    <div className="min-h-screen p-8 space-y-8 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
            <Beaker size={36} className="text-blue-500" /> Lab Diagnostic Command
          </h1>
          <p className="text-slate-500 font-bold text-xs tracking-widest uppercase mt-2">Orders · Sample Tracking · Result Management</p>
        </div>
        <div className="px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-full flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">EHR Sync Active</span>
        </div>
      </div>

      {collectError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3 text-sm font-bold">
          <AlertCircle size={16} />{collectError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Pending Orders',    value: stats.pending,   icon: Clock,       color: 'text-amber-400' },
          { label: 'Samples Collected', value: stats.collected, icon: FlaskConical,color: 'text-indigo-400' },
          { label: 'In Progress',       value: stats.processing,icon: Activity,    color: 'text-sky-400' },
          { label: 'Completed Today',   value: stats.completed, icon: CheckCircle, color: 'text-emerald-400' },
        ].map((card, i) => (
          <div key={i} className={`${panel} p-6 space-y-4`}>
            <div className={`p-2 rounded-lg bg-slate-900 w-fit ${card.color}`}><card.icon size={20} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{card.label}</p>
              <h2 className={`text-3xl font-black tracking-tighter ${card.color}`}>{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'cancelled').map(([s, cfg]) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              filterStatus === s ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : 'bg-white/5 text-slate-500 hover:text-white'
            }`}>
            {cfg.label}
          </button>
        ))}
        <button onClick={() => { fetchOrders(); fetchStats(); }} className="p-2 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-white transition ml-auto">
          <RefreshCw size={14} />
        </button>
        <button onClick={() => setShowNewOrder(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">
          <Plus size={14} /> New Order
        </button>
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-4"><Loader2 size={32} className="text-blue-500 animate-spin" /><p className="text-slate-500 text-sm font-bold">Syncing live orders...</p></div>
      ) : orders.length === 0 ? (
        <div className={`${panel} p-16 text-center space-y-4`}><FlaskConical size={40} className="text-slate-600 mx-auto" /><p className="text-slate-500 font-bold">No {STATUS_CONFIG[filterStatus]?.label.toLowerCase()} orders</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map(order => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            return (
              <div key={order.id} className={`${panel} p-6 space-y-4 hover:border-blue-500/20 transition-all`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-[10px] text-slate-600">#{order.id.slice(0, 8).toUpperCase()}</p>
                    <h4 className="font-black text-white mt-1">{order.patient_name ?? `Patient #${order.patient_id?.slice(0, 8)}`}</h4>
                    {order.doctor_name && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Ordered by Dr. {order.doctor_name}</p>}
                  </div>
                  <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    <StatusIcon size={10} />{cfg.label}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tests Ordered</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(order.tests ?? []).map((t, i) => (
                      <span key={i} className="bg-slate-900/60 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/5">
                        {typeof t === 'string' ? t : t.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-2">
                  {order.status === 'pending' && (
                    <button onClick={() => handleMarkCollected(order.id)} disabled={collecting === order.id}
                      className="w-full py-3 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                      {collecting === order.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Mark Sample Collected'}
                    </button>
                  )}
                  {['sample_collected', 'processing'].includes(order.status) && (
                    <button onClick={() => setActiveOrder(order)}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                      Enter Results
                    </button>
                  )}
                  {order.status === 'completed' && (
                    <div className="flex items-center gap-2 text-emerald-400 justify-center">
                      <CheckCircle size={14} /><span className="text-xs font-black uppercase tracking-widest">Results Submitted</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeOrder && (
        <ResultEntryModal order={activeOrder} onClose={() => setActiveOrder(null)} onSuccess={() => { fetchOrders(); fetchStats(); }} />
      )}

      {showNewOrder && (
        <NewOrderModal onClose={() => setShowNewOrder(false)} onSuccess={() => { fetchOrders(); fetchStats(); }} />
      )}
    </div>
  );
};

// ── New Order Modal ────────────────────────────────────────────────────────────
// There was no way to create a lab order anywhere in the system before this
// (no UI, and the backend endpoint itself didn't exist either — see
// lab_results.py's POST /lab/orders, added alongside this). Patient search
// reuses /reception/patients/search since that's the only patient-lookup
// endpoint in the system; lab techs aren't given a separate one.
interface PatientHit { id: string; full_name: string; phone: string; }

const NewOrderModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PatientHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [testNames, setTestNames] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patient || query.trim().length < 3) { setMatches([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiClient.get(`/reception/patients/search?q=${encodeURIComponent(query.trim())}`);
        setMatches(res.data.data || []);
      } catch { setMatches([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query, patient]);

  const submit = async () => {
    if (!patient) { setError('Select a patient first.'); return; }
    const tests = testNames.split(',').map(t => t.trim()).filter(Boolean);
    if (tests.length === 0) { setError('Enter at least one test name.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/lab/orders', { patient_id: patient.id, test_names: tests });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not create the order.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-lg p-8 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight text-white">New Lab Order</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-2 text-xs font-bold">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {!patient ? (
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Find Patient (name or phone)</label>
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            {searching && <p className="text-[10px] text-slate-500 mt-2">Searching…</p>}
            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
              {matches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPatient(p)}
                  className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-between text-left transition-all"
                >
                  <span className="font-bold text-white text-xs">{p.full_name}</span>
                  <span className="text-[11px] text-slate-500">{p.phone}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
            <div>
              <p className="font-bold text-white text-xs">{patient.full_name}</p>
              <p className="text-[11px] text-slate-500">{patient.phone}</p>
            </div>
            <button onClick={() => setPatient(null)} className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Change</button>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tests (comma-separated)</label>
          <input
            value={testNames} onChange={(e) => setTestNames(e.target.value)}
            placeholder="CBC Panel, Lipid Profile, HbA1c"
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting || !patient}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all"
        >
          {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Create Order'}
        </button>
      </div>
    </div>
  );
};

export default LabDashboard;
