/**
 * src/pages/matrix/FinancialCommand.jsx — Hospain Matrix 3.0
 * Platform-wide revenue, transactions, refunds — manager+ only
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const fmt  = (n) => n >= 1e7 ? `₹${(n/1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(2)}L` : `₹${(n||0).toLocaleString()}`;
const fmtN = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n ?? "—");

export default function FinancialCommand() {
  const financialData  = useMatrixStore((s) => s.financialData);
  const fetchFinancial = useMatrixStore((s) => s.fetchFinancial);

  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("overview");

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchFinancial();
      setLoading(false);
    })();
  }, []);

  const f   = financialData || {};
  const rev = f.revenue     || {};
  const tx  = f.transactions|| {};
  const ref = f.refunds     || {};
  const esc = f.escrow      || {};

  const TABS = [["overview","Overview"], ["transactions","Transactions"], ["refunds","Refunds"], ["escrow","Escrow"]];

  return (
    <PageShell title="Financial Command">
      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          { label:"Revenue Today",    value: fmt(rev.today),      color:"#10b981" },
          { label:"Revenue MTD",      value: fmt(rev.this_month), color:"#06b6d4" },
          { label:"Total Transactions",value: fmtN(tx.total),    color:"#6366f1" },
          { label:"Pending Refunds",  value: fmtN(ref.pending),   color: (ref.pending||0) > 10 ? "#f59e0b" : "#10b981" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{loading ? "—" : s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid rgba(255,255,255,0.06)", marginBottom:14 }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding:"8px 18px", border:"none", background:"none", cursor:"pointer", fontSize:12, fontWeight:500,
            color: tab===k ? "#818cf8" : "#475569", borderBottom: tab===k ? "2px solid #6366f1" : "2px solid transparent" }}>{l}</button>
        ))}
      </div>

      {loading ? <LoadingRows n={6} /> : (
        <>
          {tab === "overview" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {/* Revenue split */}
              <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#f1f5f9", marginBottom:14 }}>Revenue Split</div>
                {[
                  { label:"Consultation", value: rev.consultation, color:"#6366f1" },
                  { label:"Pharmacy",     value: rev.pharmacy,     color:"#10b981" },
                  { label:"Lab Services", value: rev.lab,          color:"#f59e0b" },
                  { label:"Room / OT",    value: rev.room_ot,      color:"#06b6d4" },
                  { label:"Platform Fee", value: rev.platform_fee, color:"#8b5cf6" },
                ].map((item,i) => {
                  const total = rev.this_month || 1;
                  const pct   = Math.round(((item.value||0) / total) * 100);
                  return (
                    <div key={i} style={{ marginBottom:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:12, color:"#94a3b8" }}>{item.label}</span>
                        <span style={{ fontSize:12, fontWeight:600, color:"#f1f5f9" }}>{fmt(item.value)}<span style={{ fontSize:10, color:"#475569", marginLeft:4 }}>{pct}%</span></span>
                      </div>
                      <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:item.color, borderRadius:2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Escrow summary */}
              <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#f1f5f9", marginBottom:14 }}>Escrow Summary</div>
                {[
                  { label:"Held in Escrow",    value: fmt(esc.total_held),   color:"#f59e0b" },
                  { label:"Released to Owners",value: fmt(esc.released),     color:"#10b981" },
                  { label:"Pending Release",   value: fmt(esc.pending),      color:"#6366f1" },
                  { label:"Disputed",          value: fmt(esc.disputed),     color:"#f43f5e" },
                ].map((item,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize:12, color:"#94a3b8" }}>{item.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "transactions" && (
            <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
              {(!tx.recent || tx.recent.length === 0) ? <div style={{ padding:24 }}><EmptyState msg="No transaction data" /></div> : (
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                      {["Invoice","Hospital","Amount","Method","Status","Date"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tx.recent.map((t,i) => (
                      <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding:"10px 14px", fontFamily:"monospace", fontSize:11, color:"#6366f1" }}>{t.invoice_number}</td>
                        <td style={{ padding:"10px 14px", fontSize:12, color:"#94a3b8" }}>{t.hospital_name}</td>
                        <td style={{ padding:"10px 14px", fontSize:12, fontWeight:700, color:"#10b981" }}>{fmt(t.amount)}</td>
                        <td style={{ padding:"10px 14px" }}><Badge label={t.method} variant="open" /></td>
                        <td style={{ padding:"10px 14px" }}><Badge label={t.status} variant={t.status === "completed" ? "resolved" : t.status} /></td>
                        <td style={{ padding:"10px 14px", fontSize:11, color:"#475569" }}>{t.date ? new Date(t.date).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "refunds" && (
            (!ref.list || ref.list.length === 0) ? <EmptyState msg="No refund requests" /> : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {ref.list.map((r,i) => (
                  <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#f1f5f9", marginBottom:3 }}>{r.patient_name} — {fmt(r.amount)}</div>
                      <div style={{ fontSize:11, color:"#475569" }}>{r.hospital_name} · Invoice: {r.invoice_number} · {r.reason}</div>
                    </div>
                    <Badge label={r.status} variant={r.status === "approved" ? "resolved" : r.status === "rejected" ? "critical" : "open"} />
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "escrow" && (
            (!esc.pending_list || esc.pending_list.length === 0) ? <EmptyState msg="No pending escrow releases" /> : (
              <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                      {["Hospital","Amount Held","Due Date","Status"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {esc.pending_list.map((e,i) => (
                      <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding:"10px 14px", fontSize:12, color:"#f1f5f9" }}>{e.hospital_name}</td>
                        <td style={{ padding:"10px 14px", fontSize:12, fontWeight:700, color:"#f59e0b" }}>{fmt(e.amount)}</td>
                        <td style={{ padding:"10px 14px", fontSize:11, color:"#475569" }}>{e.due_date ? new Date(e.due_date).toLocaleDateString() : "—"}</td>
                        <td style={{ padding:"10px 14px" }}><Badge label={e.status} variant={e.status==="released" ? "resolved" : "open"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </PageShell>
  );
}
