import { useEffect, useState, useCallback } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, DataTable, Badge,
  Pill, ProgressBar, StatusDot, ActionButton, SearchInput,
  EmptyState, LoadingRows,
} from "../../components/matrix/MatrixUI";

const SEV_COLOR = { P1:"#f43f5e", P2:"#f97316", P3:"#f59e0b", P4:"#475569" };
const TYPE_COLOR = { alert:"#f59e0b", action:"#06b6d4", finding:"#8b5cf6", resolution:"#10b981", postmortem:"#6366f1" };

export default function IncidentWarRoom() {
  const incidents = useMatrixStore((s) => s.incidents);
  const selected  = useMatrixStore((s) => s.selectedIncident);
  const timeline  = useMatrixStore((s) => s.incidentTimeline);
  const loading   = useMatrixStore((s) => s.incidentsLoading);
  const fetchInc  = useMatrixStore((s) => s.fetchIncidents);
  const selectInc = useMatrixStore((s) => s.selectIncident);
  const createInc = useMatrixStore((s) => s.createIncident);
  const addEntry  = useMatrixStore((s) => s.addTimelineEntry);
  const updateInc = useMatrixStore((s) => s.updateIncident);

  const [newEntry, setNewEntry] = useState("");
  const [entryType, setEntryType] = useState("action");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title:"", severity:"P3", team:"engineering" });

  useEffect(() => { fetchInc(); }, []);

  const activeCount = incidents.filter((i) => i.status === "active").length;

  return (
    <PageShell title="Incident War Room" extra={activeCount > 0 && <Pill label={`${activeCount} ACTIVE`} color="#f43f5e" />}>
      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:14, height:"calc(100% - 80px)" }}>
        {/* List */}
        <div style={{ display:"flex", flexDirection:"column", gap:6, overflowY:"auto" }}>
          <button onClick={() => setShowCreate(true)} style={{ padding:"8px 12px", borderRadius:10, border:"2px dashed rgba(255,255,255,0.1)", background:"none", color:"#475569", fontSize:12, cursor:"pointer" }}>+ Declare Incident</button>
          {incidents.map((inc) => (
            <div key={inc.incident_id} onClick={() => selectInc(inc)} style={{
              background: selected?.incident_id === inc.incident_id ? "rgba(99,102,241,0.1)" : "#0c1220",
              border: `1px solid ${selected?.incident_id === inc.incident_id ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderLeft: `3px solid ${SEV_COLOR[inc.severity] || "#475569"}`,
              borderRadius:10, padding:12, cursor:"pointer", transition:"all 0.15s",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>{inc.incident_id}</span>
                <div style={{ display:"flex", gap:4 }}>
                  <Pill label={inc.severity} color={SEV_COLOR[inc.severity]} />
                  <Badge label={inc.status} variant={inc.status==="active"?"critical":"resolved"} />
                </div>
              </div>
              <div style={{ fontSize:12, color:"#f1f5f9", fontWeight:500, lineHeight:1.3 }}>{inc.title}</div>
              <div style={{ fontSize:10, color:"#475569", marginTop:3 }}>{inc.team} · {inc.affected_count || "—"}</div>
            </div>
          ))}
        </div>

        {/* Detail */}
        {selected ? (
          <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:18, overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
              <div>
                <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                  <Pill label={selected.severity} color={SEV_COLOR[selected.severity]} />
                  <Badge label={selected.status} variant={selected.status==="active"?"critical":"resolved"} />
                </div>
                <h2 style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", margin:"0 0 4px" }}>{selected.title}</h2>
                <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>{selected.incident_id}</span>
              </div>
              {selected.status === "active" && (
                <ActionButton label="Mark Resolved" color="#10b981" onClick={async () => {
                  await useMatrixStore.getState().fetchIncidents();
                }} />
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
              {[["Owner",selected.owner_employee_id||"—"],["Team",selected.team],["Affected",selected.affected_count||"—"]].map(([k,v]) => (
                <div key={k} style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#475569", marginBottom:3 }}>{k}</div>
                  <div style={{ fontSize:12, color:"#f1f5f9", fontWeight:600 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Timeline</div>
            {timeline.map((e, i) => (
              <div key={e.id} style={{ display:"flex", gap:10, marginBottom:8 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background: TYPE_COLOR[e.entry_type] || "#475569", flexShrink:0, marginTop:2 }}/>
                  {i < timeline.length-1 && <div style={{ width:1, flex:1, background:"rgba(255,255,255,0.06)", minHeight:16 }}/>}
                </div>
                <div style={{ paddingBottom:6 }}>
                  <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace", marginRight:8 }}>{new Date(e.created_at).toLocaleTimeString()}</span>
                  <span style={{ fontSize:12, color:"#94a3b8" }}>{e.message}</span>
                  {e.author && <span style={{ fontSize:10, color:"#475569" }}> · {e.author}</span>}
                </div>
              </div>
            ))}

            {/* Add entry */}
            <div style={{ display:"flex", gap:6, marginTop:12 }}>
              <select value={entryType} onChange={(e) => setEntryType(e.target.value)}
                style={{ padding:"6px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#94a3b8", fontSize:11 }}>
                {["alert","action","finding","resolution","postmortem"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={newEntry} onChange={(e) => setNewEntry(e.target.value)} placeholder="Add timeline entry…"
                style={{ flex:1, padding:"6px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:12, outline:"none" }} />
              <ActionButton label="Add" color="#6366f1" onClick={async () => {
                if (!newEntry.trim()) return;
                await addEntry(selected.incident_id, entryType, newEntry);
                setNewEntry("");
              }} />
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, color:"#475569", fontSize:13 }}>
            Select an incident to view details
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:24, width:400 }}>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", margin:"0 0 16px" }}>Declare Incident</h3>
            {[["title","Title","text"],["team","Team","text"],["affected_count","Affected","text"]].map(([k,l,t]) => (
              <div key={k} style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:"#475569", display:"block", marginBottom:4 }}>{l}</label>
                <input type={t} value={form[k]||""} onChange={(e) => setForm((f) => ({...f,[k]:e.target.value}))}
                  style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:12, outline:"none" }} />
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:"#475569", display:"block", marginBottom:4 }}>Severity</label>
              <select value={form.severity} onChange={(e) => setForm((f) => ({...f, severity:e.target.value}))}
                style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#94a3b8", fontSize:12, outline:"none" }}>
                {["P1","P2","P3","P4"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => setShowCreate(false)} style={{ padding:"7px 16px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"none", color:"#475569", fontSize:12, cursor:"pointer" }}>Cancel</button>
              <ActionButton label="Declare" color="#f43f5e" onClick={async () => {
                if (!form.title) return;
                await createInc(form);
                setShowCreate(false);
                setForm({ title:"", severity:"P3", team:"engineering" });
              }} />
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}