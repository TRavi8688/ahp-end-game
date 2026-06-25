/**
 * src/pages/matrix/EmergencyBroadcast.jsx — Hospin Matrix 3.0
 * Send emergency broadcasts to all hospitals, doctors, staff
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const TARGETS = [
  { value:"all",          label:"Everyone (All Hospitals + Staff)" },
  { value:"hospitals",    label:"Hospital Admins Only" },
  { value:"doctors",      label:"Doctors Only" },
  { value:"nurses",       label:"Nursing Staff Only" },
  { value:"pharmacies",   label:"Pharmacies Only" },
  { value:"labs",         label:"Labs Only" },
  { value:"patients",     label:"Patients Only" },
];

const SEVERITY = ["info","medium","high","critical"];
const SEV_COLOR = { info:"#6366f1", medium:"#f59e0b", high:"#f97316", critical:"#f43f5e" };

export default function EmergencyBroadcast() {
  const broadcasts     = useMatrixStore((s) => s.broadcasts);
  const fetchBroadcasts = useMatrixStore((s) => s.fetchBroadcasts);
  const sendBroadcast  = useMatrixStore((s) => s.sendBroadcast);

  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [toast,     setToast]     = useState(null);
  const [form, setForm] = useState({ message:"", severity:"high", target:"all", channel:"push" });

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  useEffect(() => {
    (async () => { setLoading(true); await fetchBroadcasts(); setLoading(false); })();
  }, []);

  const handleSend = async () => {
    if (!form.message.trim()) return;
    setSending(true);
    try {
      await sendBroadcast(form);
      setForm({ message:"", severity:"high", target:"all", channel:"push" });
      showToast("Broadcast sent successfully to all targets");
    } catch (e) { showToast(e.message,"error"); }
    finally { setSending(false); }
  };

  const TEMPLATES = [
    { title:"Scheduled Maintenance",  msg:"Scheduled maintenance in 30 minutes. Please save all work.", sev:"medium" },
    { title:"Network Disruption",     msg:"Network issues detected. Connectivity may be intermittently affected.", sev:"high" },
    { title:"Security Alert",         msg:"Unauthorized access attempt detected. Security protocols activated.", sev:"critical" },
    { title:"System Update",          msg:"Platform update deployed successfully. All services operational.", sev:"info" },
  ];

  return (
    <PageShell title="Emergency Broadcast">
      {toast && (
        <div style={{ position:"fixed", top:24, right:24, zIndex:999, padding:"10px 18px", borderRadius:10,
          background: toast.type==="success" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
          border:`1px solid ${toast.type==="success" ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
          color: toast.type==="success" ? "#10b981" : "#f43f5e", fontSize:13, fontWeight:600 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16 }}>
        {/* Compose */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9", marginBottom:18 }}>Compose Broadcast</div>

          {/* Severity */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Severity Level</label>
            <div style={{ display:"flex", gap:6 }}>
              {SEVERITY.map(s => (
                <button key={s} onClick={() => setForm(f=>({...f, severity:s}))}
                  style={{ flex:1, padding:"7px 0", borderRadius:8, border:`1px solid ${form.severity===s ? SEV_COLOR[s]+"60" : "rgba(255,255,255,0.08)"}`,
                    background: form.severity===s ? SEV_COLOR[s]+"18" : "transparent",
                    color: form.severity===s ? SEV_COLOR[s] : "#475569", fontSize:11, fontWeight:600, cursor:"pointer", textTransform:"capitalize" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Target Audience</label>
            <select value={form.target} onChange={e => setForm(f=>({...f, target:e.target.value}))}
              style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:12 }}>
              {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Channel */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Channel</label>
            <div style={{ display:"flex", gap:6 }}>
              {["push","sms","email","all"].map(c => (
                <button key={c} onClick={() => setForm(f=>({...f, channel:c}))}
                  style={{ flex:1, padding:"7px 0", borderRadius:8, border:`1px solid ${form.channel===c ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
                    background: form.channel===c ? "rgba(99,102,241,0.15)" : "transparent",
                    color: form.channel===c ? "#818cf8" : "#475569", fontSize:11, fontWeight:600, cursor:"pointer", textTransform:"uppercase" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Message</label>
            <textarea rows={5} value={form.message} onChange={e => setForm(f=>({...f, message:e.target.value}))}
              placeholder="Type your broadcast message here…"
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:13, resize:"none", lineHeight:1.6 }} />
            <div style={{ fontSize:10, color:"#334155", marginTop:4 }}>{form.message.length} / 500 characters</div>
          </div>

          <button onClick={handleSend} disabled={!form.message.trim() || sending}
            style={{ width:"100%", padding:"12px 0", borderRadius:10, border:`1px solid ${SEV_COLOR[form.severity]}50`,
              background:`${SEV_COLOR[form.severity]}18`, color:SEV_COLOR[form.severity], fontSize:13, fontWeight:700,
              cursor: !form.message.trim()||sending ? "not-allowed" : "pointer", opacity: !form.message.trim()||sending ? 0.5 : 1 }}>
            {sending ? "Sending…" : "📡 Send Broadcast Now"}
          </button>

          {/* Templates */}
          <div style={{ marginTop:18 }}>
            <div style={{ fontSize:11, color:"#334155", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Quick Templates</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {TEMPLATES.map((t,i) => (
                <button key={i} onClick={() => setForm(f=>({...f, message:t.msg, severity:t.sev}))}
                  style={{ padding:"8px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)", textAlign:"left", cursor:"pointer" }}>
                  <div style={{ fontSize:11, fontWeight:600, color:"#94a3b8", marginBottom:2 }}>{t.title}</div>
                  <div style={{ fontSize:10, color:"#334155", lineHeight:1.4 }}>{t.msg.substring(0,50)}…</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* History */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#f1f5f9" }}>Broadcast History</span>
          </div>
          {loading ? <div style={{ padding:16 }}><LoadingRows n={5} /></div> : (
            broadcasts.length === 0 ? <div style={{ padding:24 }}><EmptyState msg="No broadcasts sent yet" /></div> : (
              <div style={{ maxHeight:500, overflowY:"auto" }}>
                {broadcasts.map((b,i) => (
                  <div key={i} style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)", borderLeft:`3px solid ${SEV_COLOR[b.severity]||"#475569"}` }}>
                    <div style={{ display:"flex", gap:6, marginBottom:5, alignItems:"center", flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:`${SEV_COLOR[b.severity]||"#475569"}18`, color:SEV_COLOR[b.severity]||"#475569", fontWeight:600 }}>{b.severity?.toUpperCase()}</span>
                      <span style={{ fontSize:10, color:"#475569" }}>→ {b.target}</span>
                      {b.estimated_reach && <span style={{ fontSize:10, color:"#334155" }}>~{b.estimated_reach?.toLocaleString()} recipients</span>}
                    </div>
                    <div style={{ fontSize:12, color:"#94a3b8", marginBottom:3 }}>{b.message}</div>
                    <div style={{ fontSize:10, color:"#334155" }}>{b.sent_at ? new Date(b.sent_at).toLocaleString() : "—"} · by {b.sent_by || "System"}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </PageShell>
  );
}
