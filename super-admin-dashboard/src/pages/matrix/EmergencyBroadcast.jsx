/**
 * src/pages/matrix/EmergencyBroadcast.jsx
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, SectionHeader, ActionButton, EmptyState, Pill, T,
} from "../../components/matrix/MatrixUI";

const TARGET_OPTIONS = [
  { key:"all_hospitals",  label:"All Hospitals" },
  { key:"all_pharmacies", label:"All Pharmacies" },
  { key:"all_patients",   label:"All Patients" },
  { key:"all_employees",  label:"All Employees" },
  { key:"hospital_admins",label:"Hospital Admins Only" },
];

const CHANNEL_OPTIONS = [
  { key:"whatsapp",     label:"WhatsApp" },
  { key:"sms",          label:"SMS" },
  { key:"push",         label:"Push Notification" },
  { key:"email",        label:"Email" },
  { key:"in_app",       label:"In-App Banner" },
];

export default function EmergencyBroadcast() {
  const broadcasts = useMatrixStore((s) => s.broadcasts);
  const fetch      = useMatrixStore((s) => s.fetchBroadcasts);
  const send       = useMatrixStore((s) => s.sendBroadcast);

  const [title,    setTitle]    = useState("");
  const [body,     setBody]     = useState("");
  const [targets,  setTargets]  = useState([]);
  const [channels, setChannels] = useState(["whatsapp","sms"]);
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);

  useEffect(() => { fetch(); }, []);

  const toggleArr = (arr, setArr, key) =>
    setArr((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const handleSend = async () => {
    if (!title || !body || !targets.length || !channels.length) return;
    setSending(true);
    try {
      await send({ title, body, targets, channels });
      setSent(true);
      setTitle(""); setBody(""); setTargets([]); setChannels(["whatsapp","sms"]);
      setTimeout(() => setSent(false), 4000);
    } finally {
      setSending(false);
    }
  };

  return (
    <PageShell title="Emergency Broadcast Center" sub="System-wide announcements via WhatsApp · SMS · Push · Email · In-App">
      {/* Compose */}
      <div style={{ background:`${T.rose}08`, border:`1px solid ${T.rose}20`, borderRadius:14, padding:18, marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <span style={{ fontSize:16 }}>📡</span>
          <span style={{ fontSize:13, fontWeight:700, color:T.rose }}>Compose Emergency Broadcast</span>
          <Pill label="SUPER ADMIN" color={T.rose} />
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:T.textDim, display:"block", marginBottom:4 }}>Broadcast Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled maintenance window — 22 Jun 02:00-04:00 IST"
            style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${T.border}`, background:"rgba(244,63,94,0.04)", color:T.text, fontSize:13, outline:"none", boxSizing:"border-box" }} />
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, color:T.textDim, display:"block", marginBottom:4 }}>Message Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
            placeholder="Write your broadcast message here…"
            style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${T.border}`, background:"rgba(244,63,94,0.04)", color:T.text, fontSize:13, resize:"vertical", outline:"none", boxSizing:"border-box" }} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:11, color:T.textDim, display:"block", marginBottom:8 }}>Target Audience</label>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {TARGET_OPTIONS.map(({ key, label }) => (
                <label key={key} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                  <input type="checkbox" checked={targets.includes(key)} onChange={() => toggleArr(targets, setTargets, key)}
                    style={{ width:13, height:13, accentColor:T.indigo }} />
                  <span style={{ fontSize:12, color: targets.includes(key) ? T.text : T.textMid }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, color:T.textDim, display:"block", marginBottom:8 }}>Delivery Channels</label>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {CHANNEL_OPTIONS.map(({ key, label }) => (
                <label key={key} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                  <input type="checkbox" checked={channels.includes(key)} onChange={() => toggleArr(channels, setChannels, key)}
                    style={{ width:13, height:13, accentColor:T.indigo }} />
                  <span style={{ fontSize:12, color: channels.includes(key) ? T.text : T.textMid }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:11, color:T.textDim }}>
            {targets.length} target group{targets.length !== 1 ? "s" : ""} · {channels.length} channel{channels.length !== 1 ? "s" : ""}
            {(!title || !body || !targets.length) && (
              <span style={{ color:T.rose, marginLeft:8 }}>Fill all required fields</span>
            )}
          </div>
          <button onClick={handleSend} disabled={sending || !title || !body || !targets.length || !channels.length} style={{
            padding:"9px 22px", borderRadius:9, border:"none",
            background: sent ? T.emerald : (sending || !title || !body || !targets.length ? "rgba(244,63,94,0.4)" : T.rose),
            color:"#fff", fontWeight:700, fontSize:13,
            cursor: sending || !title || !body || !targets.length ? "not-allowed" : "pointer",
            transition:"background 0.2s",
          }}>
            {sent ? "✓ Broadcast Sent!" : sending ? "Sending…" : "📡 Send Broadcast"}
          </button>
        </div>
      </div>

      {/* History */}
      <SectionHeader title="Broadcast History" />
      {!broadcasts.length && <EmptyState msg="No broadcasts sent yet" icon="📡" />}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {broadcasts.map((b) => (
          <div key={b.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px" }}>
            <div style={{ fontSize:13, color:T.text, fontWeight:600, marginBottom:5 }}>{b.title}</div>
            <div style={{ fontSize:12, color:T.textMid, marginBottom:8, lineHeight:1.4 }}>{b.body?.slice(0,200)}{b.body?.length > 200 ? "…" : ""}</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", fontSize:11, color:T.textDim }}>
              <span>📡 {(b.targets || []).join(", ")}</span>
              <span>👥 {Number(b.reach_count).toLocaleString()} estimated reach</span>
              <span>🕐 {new Date(b.sent_at).toLocaleString()}</span>
              <span>📤 {b.sent_by || "System"}</span>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
