// src/pages/ReferralTracking.jsx
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchReferrals,
  fetchReferralStats,
  fetchPayouts,
  fetchReferralLink,
} from '../store/referralSlice';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';

const STATUS_TABS = ['all', 'clicked', 'registered', 'converted'];

const refStatusCfg = {
  clicked:    { color: '#f59e0b', bg: '#f59e0b18', label: 'Clicked'    },
  registered: { color: '#0ea5e9', bg: '#0ea5e918', label: 'Registered' },
  converted:  { color: '#22c55e', bg: '#22c55e18', label: 'Converted'  },
  churned:    { color: '#ef4444', bg: '#ef444418', label: 'Churned'    },
};

const payoutStatusCfg = {
  pending:    { color: '#f59e0b', label: 'Pending'    },
  processing: { color: '#0ea5e9', label: 'Processing' },
  paid:       { color: '#22c55e', label: 'Paid'       },
};

const fmt     = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── Stat card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = '#0ea5e9', loading }) {
  return (
    <div className="bg-[#0d1929] border border-[#1e3a5f]/60 rounded-2xl p-5">
      <p className="text-[#64748b] text-xs uppercase tracking-widest font-medium mb-2">{label}</p>
      {loading
        ? <div className="h-8 w-20 bg-[#1e3a5f]/30 rounded-lg animate-pulse" />
        : <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      }
      {sub && <p className="text-[#475569] text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1929] border border-[#1e3a5f] rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-[#94a3b8] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function ReferralTracking() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { referrals, stats, payouts, link, loading, statsLoading, error } = useSelector((s) => s.referrals);

  const [activeTab,  setActiveTab]  = useState('all');
  const [copied,     setCopied]     = useState(false);
  const [activeView, setActiveView] = useState('referrals'); // referrals | payouts

  useEffect(() => {
    dispatch(fetchReferralStats());
    dispatch(fetchReferralLink());
    dispatch(fetchPayouts());
    dispatch(fetchReferrals());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchReferrals({ status: activeTab }));
  }, [dispatch, activeTab]);

  const copyLink = () => {
    if (!stats?.referral_url) return;
    navigator.clipboard.writeText(stats.referral_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#020917] text-white">
      {/* ── Header ── */}
      <header className="border-b border-[#1e3a5f]/60 bg-[#020917]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-[#475569] hover:text-white transition-colors text-sm">
            ← Dashboard
          </button>
          <span className="text-[#1e3a5f]">/</span>
          <span className="text-white font-semibold">Referral Tracking</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Referral Tracking</h1>
          <p className="text-[#64748b] text-sm mt-0.5">Manage your referral links, track conversions and commissions</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
        )}

        {/* ── Top section: Link card + KPIs ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Referral link card */}
          <div className="lg:col-span-1 bg-[#0d1929] border border-[#1e3a5f]/60 rounded-2xl p-6 flex flex-col gap-5">
            <div>
              <p className="text-xs text-[#64748b] uppercase tracking-widest mb-1">Your Referral Link</p>
              <p className="text-[#94a3b8] text-xs mb-4">Share this link to earn commissions on every converted patient</p>
            </div>

            {/* QR code */}
            <div className="flex justify-center">
              {statsLoading || !stats?.referral_url ? (
                <div className="w-36 h-36 bg-[#1e3a5f]/20 rounded-2xl animate-pulse" />
              ) : (
                <div className="bg-white p-3 rounded-2xl">
                  <QRCodeSVG value={stats.referral_url} size={128} bgColor="#ffffff" fgColor="#020917" />
                </div>
              )}
            </div>

            {/* Code badge */}
            {stats?.referral_code && (
              <div className="text-center">
                <span className="font-mono text-[#38bdf8] text-lg font-bold tracking-widest">{stats.referral_code}</span>
              </div>
            )}

            {/* URL + copy */}
            <div className="bg-[#0a111e] border border-[#1e3a5f]/50 rounded-xl p-3">
              <p className="text-[#475569] text-xs truncate font-mono mb-2">
                {statsLoading ? 'Loading...' : stats?.referral_url}
              </p>
              <button
                onClick={copyLink}
                disabled={!stats?.referral_url}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-all border ${
                  copied
                    ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#4ade80]'
                    : 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#38bdf8] hover:bg-[#0ea5e9]/20'
                }`}
              >
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* KPI grid */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
            <KpiCard label="Total Clicks"        value={stats?.total_clicks ?? '—'}                                            loading={statsLoading} />
            <KpiCard label="Registrations"       value={stats?.total_registrations ?? '—'}                  accent="#0ea5e9"   loading={statsLoading} />
            <KpiCard label="Conversions"         value={stats?.total_conversions ?? '—'}                    accent="#22c55e"   loading={statsLoading}
              sub={stats ? `${(stats.conversion_rate * 100).toFixed(1)}% rate` : undefined} />
            <KpiCard label="Commission Earned"   value={stats ? fmt(stats.total_commission_earned) : '—'}  accent="#a78bfa"   loading={statsLoading} />
            <KpiCard label="Commission Pending"  value={stats ? fmt(stats.commission_pending) : '—'}        accent="#f59e0b"   loading={statsLoading} />
            <KpiCard label="Commission Paid"     value={stats ? fmt(stats.commission_paid) : '—'}           accent="#22c55e"   loading={statsLoading} />
          </div>
        </div>

        {/* ── Trend chart ── */}
        <div className="bg-[#0d1929] border border-[#1e3a5f]/60 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-6">Monthly Referral Trend</h2>
          {statsLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.monthly_trend ?? []} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                <XAxis dataKey="month" stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="clicks"        fill="#1e3a5f"  name="Clicks"         radius={[4,4,0,0]} />
                <Bar dataKey="registrations" fill="#0ea5e9"  name="Registrations"  radius={[4,4,0,0]} />
                <Bar dataKey="conversions"   fill="#22c55e"  name="Conversions"    radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── View toggle ── */}
        <div className="flex gap-2">
          {['referrals', 'payouts'].map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                activeView === v
                  ? 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#38bdf8]'
                  : 'bg-[#0d1929] border-[#1e3a5f] text-[#64748b] hover:text-white'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Referrals Table ── */}
        {activeView === 'referrals' && (
          <>
            {/* Status filter tabs */}
            <div className="flex gap-1 flex-wrap">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    activeTab === tab
                      ? 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#38bdf8]'
                      : 'bg-[#0d1929] border-[#1e3a5f] text-[#64748b] hover:text-white'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="bg-[#0d1929] border border-[#1e3a5f]/60 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f]/60">
                    {['Patient', 'Referral Date', 'Registered', 'First Order', 'Status', 'Commission', 'Orders'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[#475569] text-xs font-medium uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? [...Array(5)].map((_, i) => (
                        <tr key={i} className="border-b border-[#1e3a5f]/20">
                          {[...Array(7)].map((__, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 bg-[#1e3a5f]/20 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : referrals.map((ref) => {
                        const cfg = refStatusCfg[ref.status] ?? refStatusCfg.clicked;
                        return (
                          <tr key={ref.id} className="border-b border-[#1e3a5f]/20 hover:bg-[#1e3a5f]/10 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-white font-medium">{ref.patient_name}</p>
                              <p className="text-[#475569] text-xs">{ref.patient_phone}</p>
                            </td>
                            <td className="px-4 py-3 text-[#94a3b8] text-xs">{fmtDate(ref.referral_date)}</td>
                            <td className="px-4 py-3 text-[#94a3b8] text-xs">{fmtDate(ref.registration_date)}</td>
                            <td className="px-4 py-3 text-[#94a3b8] text-xs">{fmtDate(ref.first_order_date)}</td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium"
                                style={{ background: cfg.bg, color: cfg.color }}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {ref.commission_amount > 0 ? (
                                <div>
                                  <p className="text-[#a78bfa] font-semibold">{fmt(ref.commission_amount)}</p>
                                  <p className={`text-[10px] ${ref.commission_status === 'paid' ? 'text-[#22c55e]' : 'text-[#f59e0b]'}`}>
                                    {ref.commission_status}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-[#334155]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {ref.order_count > 0 ? (
                                <div>
                                  <p className="text-white font-medium">{ref.order_count}</p>
                                  <p className="text-[#475569] text-xs">LTV {fmt(ref.lifetime_value)}</p>
                                </div>
                              ) : (
                                <span className="text-[#334155]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
              {!loading && referrals.length === 0 && (
                <div className="text-center py-14 text-[#475569]">No referrals found</div>
              )}
            </div>
          </>
        )}

        {/* ── Payouts Table ── */}
        {activeView === 'payouts' && (
          <div className="bg-[#0d1929] border border-[#1e3a5f]/60 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f]/60">
                  {['Period', 'Referrals', 'Amount', 'Status', 'Transaction Ref', 'Paid On'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[#475569] text-xs font-medium uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => {
                  const cfg = payoutStatusCfg[payout.status] ?? payoutStatusCfg.pending;
                  return (
                    <tr key={payout.id} className="border-b border-[#1e3a5f]/20 hover:bg-[#1e3a5f]/10 transition-colors">
                      <td className="px-4 py-3 text-[#94a3b8] text-xs">
                        {fmtDate(payout.period_start)} – {fmtDate(payout.period_end)}
                      </td>
                      <td className="px-4 py-3 text-white text-center">{payout.referral_count}</td>
                      <td className="px-4 py-3 text-white font-bold">{fmt(payout.amount)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: `${cfg.color}18`, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#64748b]">
                        {payout.transaction_ref ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8] text-xs">{fmtDate(payout.paid_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {payouts.length === 0 && (
              <div className="text-center py-14 text-[#475569]">No payout history</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
