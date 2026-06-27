/**
 * src/pages/matrix/AutoAssignmentEngine.jsx — Hospain Matrix 3.0
 * Built: shows live assignment rules, queue stats, and lets team leads configure routing
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows, SectionHeader, ActionButton } from "../../components/matrix/MatrixUI";
import { api } from "../../lib/apiClient";

const CATEGORIES = ["billing","technical","appointment","prescription","lab_result","emergency","general"];
const TEAMS      = ["support","finance","engineering","onboarding","data","verification"];

export default function AutoAssignmentEngine() {
  const employees = useMatrixStore((s) => s.employees);
  const fetchEmployees = useMatrixStore((s) => s.fetchEmployees);

  const [rules,        setRules]        = useState([]);
  const [queueStats,   setQueueStats]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState(null);
  const [editingRule,  setEditingRule]  = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, statsRes] = await Promise.all([
        api.get("/api/v1/matrix/assignment/rules"),
        api.get("/api/v1/matrix/assignment/stats"),
      ]);
      setRules(Array.isArray(rulesRes?.data) ? rulesRes.data : []);
      setQueueStats(statsRes?.data || null);
    } catch {
      // backend not connected yet — show UI with empty state
    } finally {
      setLoading(false);
    }
    fetchEmployees({ shift_status: "online" });
  };

  useEffect(() => { fetchData(); }, []);

  const saveRule = async (rule) => {
    setSaving(true);
    try {
      if (rule.id) {
        await api.put(`/api/v1/matrix/assignment/rules/${rule.id}`, rule);
      } else {
        await api.post("/api/v1/matrix/assignment/rules", rule);
      }
      showToast("Rule saved");
      setEditingRule(null);
      fetchData();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id) => {
    try {
      await api.delete(`/api/v1/matrix/assignment/rules/${id}`);
      showToast("Rule deleted");
      fetchData();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const onlineAgents = employees.filter(e => e.shift_status === "online" && ["l1","l2"].includes(e.role));

  return (
    <PageShell title="Auto-Assignment Engine">
      {toast && (
        <div style={{ position:"fixed", top:24, right:24, zIndex:999, padding:"10px 18px", borderRadius:10,
          background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
          border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
          color: toast.type === "success" ? "#10b981" : "#f43f5e", fontSize:13, fontWeight:600 }}>
          {toast.msg}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          { label:"Online Agents",    value: onlineAgents.length,                  color:"#10b981" },
          { label:"Queue Depth",      value: queueStats?.queue_depth ?? "—",       color:"#f59e0b" },
          { label:"Avg Handle Time",  value: queueStats?.avg_handle_time ?? "—",   color:"#6366f1" },
          { label:"Assignment Rules", value: rules.length,                          color:"#06b6d4" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:14 }}>
        {/* Assignment Rules */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#f1f5f9" }}>Routing Rules</span>
            <button onClick={() => setEditingRule({ category:"billing", team:"support", priority:"high", round_robin:true })}
              style={{ padding:"5px 12px", borderRadius:8, background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", fontSize:11, fontWeight:600, cursor:"pointer" }}>
              + Add Rule
            </button>
          </div>
          {loading ? <div style={{ padding:16 }}><LoadingRows n={4} /></div> : (
            rules.length === 0 ? (
              <div style={{ padding:24 }}>
                <EmptyState msg="No routing rules yet. Add one to start auto-assigning tickets." />
              </div>
            ) : (
              <div>
                {rules.map(rule => (
                  <div key={rule.id} style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)", display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                        <Badge label={rule.category} variant="open" />
                        <span style={{ fontSize:10, color:"#475569" }}>→</span>
                        <Badge label={rule.team} variant="open" />
                        <Badge label={rule.priority} variant={rule.priority} />
                        {rule.round_robin && <Badge label="round-robin" variant="open" />}
                      </div>
                      <div style={{ fontSize:11, color:"#475569" }}>
                        Max load: {rule.max_tickets_per_agent ?? 30} · SLA: {rule.sla_hours ?? 24}h
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => setEditingRule(rule)}
                        style={{ padding:"4px 10px", borderRadius:6, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#94a3b8", fontSize:11, cursor:"pointer" }}>Edit</button>
                      <button onClick={() => deleteRule(rule.id)}
                        style={{ padding:"4px 10px", borderRadius:6, background:"rgba(244,63,94,0.08)", border:"1px solid rgba(244,63,94,0.2)", color:"#f43f5e", fontSize:11, cursor:"pointer" }}>Del</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Live agent load */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#f1f5f9" }}>Live Agent Load</span>
          </div>
          {onlineAgents.length === 0 ? (
            <div style={{ padding:24 }}><EmptyState msg="No agents online right now" /></div>
          ) : (
            <div>
              {onlineAgents.slice(0, 12).map(agent => {
                const load = agent.open_ticket_count ?? 0;
                const max  = agent.daily_ticket_limit ?? 30;
                const pct  = Math.min(100, Math.round((load / max) * 100));
                const col  = pct > 80 ? "#f43f5e" : pct > 50 ? "#f59e0b" : "#10b981";
                return (
                  <div key={agent.employee_id} style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ fontSize:12, color:"#f1f5f9" }}>{agent.full_name}</span>
                      <span style={{ fontSize:11, color:col, fontWeight:600 }}>{load}/{max}</span>
                    </div>
                    <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:2, transition:"width 0.3s" }} />
                    </div>
                    <div style={{ fontSize:10, color:"#334155", marginTop:3 }}>{agent.team} · {agent.role?.toUpperCase()}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit rule modal */}
      {editingRule && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}
          onClick={e => e.target === e.currentTarget && setEditingRule(null)}>
          <div style={{ background:"#0d1525", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:24, width:400 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9", marginBottom:18 }}>
              {editingRule.id ? "Edit Rule" : "New Assignment Rule"}
            </div>
            {[
              { label:"Category", key:"category", options: CATEGORIES },
              { label:"Route to Team", key:"team", options: TEAMS },
              { label:"Priority", key:"priority", options:["critical","high","medium","low"] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ display:"block", fontSize:11, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>{f.label}</label>
                <select value={editingRule[f.key] || ""} onChange={e => setEditingRule(r => ({ ...r, [f.key]: e.target.value }))}
                  style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:12 }}>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5, display:"block" }}>Max tickets per agent</label>
              <input type="number" value={editingRule.max_tickets_per_agent ?? 30}
                onChange={e => setEditingRule(r => ({ ...r, max_tickets_per_agent: Number(e.target.value) }))}
                style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:12 }} />
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:18 }}>
              <input type="checkbox" checked={editingRule.round_robin ?? true}
                onChange={e => setEditingRule(r => ({ ...r, round_robin: e.target.checked }))} />
              <span style={{ fontSize:12, color:"#94a3b8" }}>Round-robin across available agents</span>
            </label>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => setEditingRule(null)}
                style={{ padding:"8px 16px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748b", fontSize:12, cursor:"pointer" }}>Cancel</button>
              <button onClick={() => saveRule(editingRule)} disabled={saving}
                style={{ padding:"8px 16px", borderRadius:8, background:"rgba(99,102,241,0.2)", border:"1px solid rgba(99,102,241,0.35)", color:"#818cf8", fontSize:12, fontWeight:600, cursor:"pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
