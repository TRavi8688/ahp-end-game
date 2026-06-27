/**
 * src/pages/matrix/AICopilot.jsx — Hospin Matrix 3.0
 * FIX: uses api from lib/apiClient (correct URL + auth token)
 * instead of direct fetch with localStorage token and wrong VITE_API_URL
 */
import { useState, useRef } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { api } from "../../lib/apiClient";
import { Pill, Badge, EmptyState } from "../../components/matrix/MatrixUI";

const SUGGESTIONS = [
  "Show all hospitals with increasing complaints in the last 7 days",
  "Which employees have SLA violations this week?",
  "Show critical tickets older than 2 hours",
  "Generate a weekly operations summary",
  "Predict ticket surge for next 48 hours",
  "Detect unusual transaction patterns",
  "Recommend staffing levels for tomorrow",
  "Which pharmacies have the most complaints?",
];

export default function AICopilot() {
  const employee = useMatrixStore((s) => s.employee);
  const [messages, setMessages] = useState([
    { role:"ai", content:"I am your AI Operations Copilot. I have full visibility into the Hospin ecosystem — tickets, hospitals, employees, financials, incidents. What would you like to know?" },
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState(null);
  const endRef = useRef(null);

  const buildSystemPrompt = () =>
    `You are the AI Operations Copilot for Hospin Matrix 3.0 — an enterprise healthcare operations platform managing 10,000+ hospitals across India.
Employee: ${employee?.full_name || "Super Admin"} (${employee?.level || "super_admin"}, ${employee?.team || "operations"}).
Date: ${new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })}.
Be direct, data-driven, and actionable. Use markdown formatting.`;

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role:"user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    const t0 = Date.now();
    try {
      // FIX: use api (correct URL + auth token from tokenStore, not localStorage)
      const res = await api.post("/api/v1/matrix/ai/chat", {
        system_prompt: buildSystemPrompt(),
        messages: [...messages, userMsg].map((m) => ({
          role:    m.role === "ai" ? "assistant" : "user",
          content: m.content,
        })),
      });
      const aiText = res?.content || res?.data?.content || "Unable to process. Please try again.";
      const ms = Date.now() - t0;
      setLatency(ms);
      setMessages((m) => [...m, { role:"ai", content: aiText }]);
      // FIX: log uses api too
      try { await api.post("/api/v1/matrix/ai/log", { query: text, response: aiText, queried_by: employee?.employee_id, latency_ms: ms }); } catch {}
    } catch {
      setMessages((m) => [...m, { role:"ai", content:"⚠️ AI service unavailable. Check your network and try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", padding:"20px 24px", overflow:"hidden" }}>
      <div style={{ marginBottom:16, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:3 }}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🤖</div>
          <h1 style={{ fontSize:17, fontWeight:900, color:"#f1f5f9", margin:0 }}>AI Operations Copilot</h1>
          <Pill label="claude-sonnet-4-6" color="#8b5cf6" />
          {latency && <span style={{ fontSize:10, color:"#475569" }}>{latency}ms</span>}
        </div>
        <p style={{ fontSize:12, color:"#475569", margin:0 }}>Ask anything — tickets, hospitals, employees, financials, incidents, trends</p>
      </div>

      <div style={{ flex:1, overflowY:"auto", marginBottom:12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:"flex", gap:8, marginBottom:14, justifyContent: m.role==="user" ? "flex-end" : "flex-start" }}>
            {m.role==="ai" && <div style={{ width:26, height:26, borderRadius:"50%", background:"rgba(99,102,241,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>🤖</div>}
            <div style={{ maxWidth:"75%", padding:"10px 14px",
              borderRadius: m.role==="user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              background:   m.role==="user" ? "rgba(99,102,241,0.18)" : "#0c1220",
              border:`1px solid ${m.role==="user" ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
              fontSize:13, color:"#94a3b8", lineHeight:1.6, whiteSpace:"pre-wrap" }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:"rgba(99,102,241,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>🤖</div>
            <div style={{ padding:"10px 14px", background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"12px 12px 12px 2px", display:"flex", gap:4, alignItems:"center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#6366f1", animation:`pulse 1.2s ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10, flexShrink:0 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => send(s)} style={{ padding:"3px 9px", borderRadius:12, border:"1px solid rgba(255,255,255,0.07)", background:"none", color:"#475569", fontSize:10, cursor:"pointer" }}
            onMouseEnter={e => { e.target.style.color="#818cf8"; e.target.style.borderColor="rgba(99,102,241,0.4)"; }}
            onMouseLeave={e => { e.target.style.color="#475569"; e.target.style.borderColor="rgba(255,255,255,0.07)"; }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && !e.shiftKey && send(input)}
          placeholder="Ask anything about the Hospin ecosystem…"
          style={{ flex:1, padding:"10px 14px", borderRadius:10, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:13, outline:"none" }}
          onFocus={e => e.target.style.borderColor="#6366f1"}
          onBlur={e  => e.target.style.borderColor="rgba(255,255,255,0.08)"} />
        <button onClick={() => send(input)} disabled={loading || !input.trim()}
          style={{ padding:"10px 18px", borderRadius:10, border:"none", background: loading || !input.trim() ? "rgba(99,102,241,0.3)" : "#6366f1", color:"#fff", fontSize:12, fontWeight:700, cursor: loading||!input.trim() ? "not-allowed" : "pointer" }}>
          Send
        </button>
      </div>
    </div>
  );
}
