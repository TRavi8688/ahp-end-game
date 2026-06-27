/**
 * src/components/matrix/MatrixUI.jsx
 *
 * Shared component library for all 21 Hospain Matrix modules.
 * Every Matrix page imports from here — no duplicated UI code.
 *
 * Components:
 *   PageShell        — standard page wrapper with title/sub/live badge
 *   MetricCard       — single KPI card with label/value/sub/color
 *   SectionHeader    — h2 + subtitle + optional action button
 *   DataTable        — sortable table with hover rows
 *   Badge            — priority/status pill
 *   Pill             — small label pill
 *   ProgressBar      — horizontal bar with color
 *   StatusDot        — colored dot + text (operational/degraded/down)
 *   ActionButton     — compact colored button
 *   SearchInput      — dark-themed search input
 *   EmptyState       — centered empty message
 *   LoadingRows      — skeleton loading rows
 *   Modal            — full-screen overlay modal
 *   FormField        — labeled input/select wrapper
 *   StatRow          — key:value row for detail panels
 */

// ─── Design tokens ────────────────────────────────────────────────────────────
export const T = {
  bg:       "#060a12",
  surface:  "#0c1220",
  surfaceL: "#0f1928",
  border:   "rgba(255,255,255,0.06)",
  borderHov:"rgba(255,255,255,0.12)",
  indigo:   "#6366f1",
  indigoL:  "#818cf8",
  emerald:  "#10b981",
  amber:    "#f59e0b",
  rose:     "#f43f5e",
  cyan:     "#06b6d4",
  violet:   "#8b5cf6",
  orange:   "#f97316",
  slate:    "#475569",
  text:     "#f1f5f9",
  textMid:  "#94a3b8",
  textDim:  "#475569",
};

const BADGE_STYLES = {
  // priority
  critical:     { bg:"rgba(244,63,94,0.12)",  color:T.rose },
  high:         { bg:"rgba(249,115,22,0.12)", color:T.orange },
  medium:       { bg:"rgba(245,158,11,0.12)", color:T.amber },
  low:          { bg:"rgba(71,85,105,0.12)",  color:T.slate },
  // status
  open:         { bg:"rgba(99,102,241,0.12)", color:T.indigoL },
  in_progress:  { bg:"rgba(6,182,212,0.12)",  color:T.cyan },
  waiting:      { bg:"rgba(245,158,11,0.12)", color:T.amber },
  waiting_on_user:{ bg:"rgba(245,158,11,0.12)", color:T.amber },
  escalated:    { bg:"rgba(244,63,94,0.12)",  color:T.rose },
  resolved:     { bg:"rgba(16,185,129,0.12)", color:T.emerald },
  closed:       { bg:"rgba(71,85,105,0.12)",  color:T.slate },
  // verification
  pending:      { bg:"rgba(245,158,11,0.12)", color:T.amber },
  pending_verification: { bg:"rgba(245,158,11,0.12)", color:T.amber },
  approved:     { bg:"rgba(16,185,129,0.12)", color:T.emerald },
  rejected:     { bg:"rgba(244,63,94,0.12)",  color:T.rose },
  active:       { bg:"rgba(16,185,129,0.12)", color:T.emerald },
  suspended:    { bg:"rgba(244,63,94,0.12)",  color:T.rose },
  // shift
  online:       { bg:"rgba(16,185,129,0.12)", color:T.emerald },
  offline:      { bg:"rgba(71,85,105,0.12)",  color:T.slate },
  break:        { bg:"rgba(245,158,11,0.12)", color:T.amber },
  meeting:      { bg:"rgba(6,182,212,0.12)",  color:T.cyan },
  training:     { bg:"rgba(139,92,246,0.12)", color:T.violet },
  leave:        { bg:"rgba(244,63,94,0.12)",  color:T.rose },
  // level
  l1:           { bg:"rgba(99,102,241,0.12)", color:T.indigoL },
  l2:           { bg:"rgba(6,182,212,0.12)",  color:T.cyan },
  team_lead:    { bg:"rgba(245,158,11,0.12)", color:T.amber },
  manager:      { bg:"rgba(139,92,246,0.12)", color:T.violet },
  super_admin:  { bg:"rgba(244,63,94,0.12)",  color:T.rose },
};

// ─── PageShell ────────────────────────────────────────────────────────────────
export function PageShell({ title, sub, live, extra, action, onAction, children }) {
  return (
    <div style={{ padding:"22px 24px", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: sub ? 4 : 0 }}>
            <h1 style={{ fontSize:19, fontWeight:900, color:T.text, margin:0, letterSpacing:"-0.02em" }}>{title}</h1>
            {live && (
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:T.emerald, boxShadow:`0 0 6px ${T.emerald}`, animation:"pulse 1.5s infinite" }}/>
                <span style={{ fontSize:9, color:T.emerald, fontWeight:800, letterSpacing:"0.1em" }}>LIVE</span>
              </div>
            )}
            {extra}
          </div>
          {sub && <p style={{ fontSize:12, color:T.textDim, margin:0, lineHeight:1.4 }}>{sub}</p>}
        </div>
        {action && (
          <button onClick={onAction} style={{
            padding:"7px 14px", borderRadius:8, border:`1px solid ${T.border}`,
            background:"none", color:T.textMid, fontSize:12, cursor:"pointer",
            transition:"all 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.indigo; e.currentTarget.style.color = T.indigoL; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
          >{action}</button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, color, sparkle, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:   T.surface,
      border:       `1px solid ${T.border}`,
      borderLeft:   `3px solid ${color || T.indigo}`,
      borderRadius: 12,
      padding:      "13px 15px",
      cursor:       onClick ? "pointer" : "default",
      transition:   "border-color 0.15s",
    }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = T.borderHov; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.borderColor = T.border; }}
    >
      <div style={{ fontSize:9, color:T.textDim, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:21, fontWeight:800, color: sparkle || T.text, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em" }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize:10, color:T.textDim, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
export function SectionHeader({ title, sub, action, onAction }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
      <div>
        <h2 style={{ fontSize:15, fontWeight:800, color:T.text, margin:0 }}>{title}</h2>
        {sub && <p style={{ fontSize:11, color:T.textDim, margin:"3px 0 0", lineHeight:1.4 }}>{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction} style={{
          padding:"5px 12px", borderRadius:7, border:`1px solid ${T.border}`,
          background:"none", color:T.textMid, fontSize:11, cursor:"pointer",
        }}>{action}</button>
      )}
    </div>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────
export function DataTable({ cols, rows, onRowClick, emptyMsg }) {
  if (!rows?.length) return <EmptyState msg={emptyMsg || "No data"} />;
  return (
    <div style={{ overflowX:"auto", background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{
                textAlign:"left", padding:"9px 12px",
                color:T.textDim, fontSize:9, fontWeight:700,
                textTransform:"uppercase", letterSpacing:"0.08em",
                borderBottom:`1px solid ${T.border}`,
                whiteSpace:"nowrap",
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} onClick={() => onRowClick?.(row, i)} style={{
              borderBottom: i < rows.length-1 ? `1px solid ${T.border}` : "none",
              cursor: onRowClick ? "pointer" : "default",
              transition:"background 0.12s",
            }}
              onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.background="rgba(255,255,255,0.02)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background="transparent"; }}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding:"9px 12px", color:T.textMid, verticalAlign:"middle" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ label, variant }) {
  const s = BADGE_STYLES[variant?.toLowerCase?.().replace(/\s+/g,"_")] || { bg:"rgba(255,255,255,0.06)", color:T.textMid };
  return (
    <span style={{
      background:    s.bg,
      color:         s.color,
      padding:       "2px 7px",
      borderRadius:  20,
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      whiteSpace:    "nowrap",
      display:       "inline-block",
    }}>{label}</span>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
export function Pill({ label, color }) {
  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      padding:       "2px 8px",
      borderRadius:  20,
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      background:    `${color || T.indigo}18`,
      color:         color || T.indigoL,
      border:        `1px solid ${color || T.indigo}30`,
    }}>{label}</span>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color }) {
  const pct = Math.min(100, Math.max(0, ((value || 0) / (max || 1)) * 100));
  return (
    <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:4, height:4, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background: color || T.indigo, borderRadius:4, transition:"width 0.4s ease" }} />
    </div>
  );
}

// ─── StatusDot ────────────────────────────────────────────────────────────────
export function StatusDot({ status }) {
  const map = { operational:T.emerald, degraded:T.amber, down:T.rose };
  const c   = map[status] || T.slate;
  return (
    <span style={{ display:"flex", alignItems:"center", gap:5 }}>
      <span style={{
        width:7, height:7, borderRadius:"50%", background:c, flexShrink:0,
        boxShadow:  status === "operational" ? `0 0 5px ${c}` : "none",
        animation:  status === "operational" ? "pulse 2s infinite" : "none",
      }} />
      <span style={{ fontSize:10, color:T.textMid, textTransform:"capitalize" }}>{status}</span>
    </span>
  );
}

// ─── ActionButton ─────────────────────────────────────────────────────────────
export function ActionButton({ label, color, onClick, disabled, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:      small ? "4px 10px" : "6px 14px",
      borderRadius: 8,
      border:       `1px solid ${color || T.indigo}40`,
      background:   `${color || T.indigo}14`,
      color:        color || T.indigoL,
      fontSize:     small ? 10 : 12,
      fontWeight:   600,
      cursor:       disabled ? "not-allowed" : "pointer",
      opacity:      disabled ? 0.5 : 1,
      transition:   "all 0.12s",
      whiteSpace:   "nowrap",
    }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color || T.indigo}28`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = `${color || T.indigo}14`; }}
    >{label}</button>
  );
}

// ─── SearchInput ──────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position:"relative", flex:1, minWidth:180 }}>
      <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.textDim, fontSize:13, pointerEvents:"none" }}>🔍</span>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search…"}
        style={{
          width:"100%", padding:"6px 10px 6px 30px",
          borderRadius:8, border:`1px solid ${T.border}`,
          background:T.surface, color:T.text, fontSize:12, outline:"none",
          boxSizing:"border-box",
        }}
        onFocus={(e)  => e.target.style.borderColor = T.indigo}
        onBlur={(e)   => e.target.style.borderColor = T.border}
      />
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ msg, icon }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px", color:T.textDim }}>
      <div style={{ fontSize:32, marginBottom:10 }}>{icon || "📭"}</div>
      <div style={{ fontSize:13 }}>{msg || "Nothing here yet"}</div>
    </div>
  );
}

// ─── LoadingRows ──────────────────────────────────────────────────────────────
export function LoadingRows({ n = 5 }) {
  return (
    <div>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{
          height:52, borderRadius:9, background:"rgba(255,255,255,0.02)",
          border:`1px solid ${T.border}`, marginBottom:6,
          animation:"pulse 1.5s infinite",
          animationDelay:`${i*0.1}s`,
        }} />
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width }) {
  if (!open) return null;
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:200, padding:20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background:T.surface, border:`1px solid ${T.border}`,
        borderRadius:16, padding:24,
        width: width || 440, maxWidth:"100%",
        maxHeight:"90vh", overflowY:"auto",
        animation:"fadeIn 0.15s ease",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:T.text, margin:0 }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textDim, cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────
export function FormField({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, color:T.textDim, display:"block", marginBottom:5, fontWeight:600 }}>{label}</label>
      {children}
    </div>
  );
}

export const inputStyle = {
  width:"100%", padding:"8px 10px", borderRadius:8,
  border:`1px solid ${T.border}`, background:T.bg,
  color:T.text, fontSize:12, outline:"none", boxSizing:"border-box",
};

export const selectStyle = {
  ...{ width:"100%", padding:"8px 10px", borderRadius:8,
    border:`1px solid rgba(255,255,255,0.08)`, background:T.bg,
    color:T.textMid, fontSize:12, outline:"none", boxSizing:"border-box" }
};

// ─── StatRow ──────────────────────────────────────────────────────────────────
export function StatRow({ label, value, color }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
      <span style={{ fontSize:11, color:T.textDim }}>{label}</span>
      <span style={{ fontSize:12, color: color || T.text, fontWeight:500 }}>{value ?? "—"}</span>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
export function Timeline({ entries, typeColorMap }) {
  if (!entries?.length) return <EmptyState msg="No timeline entries" />;
  return (
    <div>
      {entries.map((e, i) => (
        <div key={e.id || i} style={{ display:"flex", gap:10, marginBottom:8 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, marginTop:3,
              background: typeColorMap?.[e.entry_type] || typeColorMap?.[e.type] || T.indigo,
            }} />
            {i < entries.length-1 && <div style={{ width:1, flex:1, background:T.border, minHeight:14 }}/>}
          </div>
          <div style={{ paddingBottom:6 }}>
            <span style={{ fontSize:10, color:T.textDim, fontFamily:"monospace", marginRight:8 }}>
              {new Date(e.created_at || e.ts).toLocaleTimeString()}
            </span>
            <span style={{ fontSize:12, color:T.textMid }}>{e.message || e.msg}</span>
            {(e.author || e.actor) && (
              <span style={{ fontSize:10, color:T.textDim }}> · {e.author || e.actor}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
