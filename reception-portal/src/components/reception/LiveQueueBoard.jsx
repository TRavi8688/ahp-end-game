import { useLiveQueue } from "../../hooks/useLiveQueue";

/**
 * LiveQueueBoard
 * Props:
 *   hospitalId
 *   compact — boolean, for sidebar view
 */
const LiveQueueBoard = ({ hospitalId, compact = false }) => {
  const { queue, connected, loading, refetch } = useLiveQueue(hospitalId);

  const grouped = queue.reduce((acc, token) => {
    const key = token.doctor_name || token.department || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(token);
    return acc;
  }, {});

  const typeColor = {
    emergency: "#dc2626",
    walk_in: "#2563eb",
    appointment: "#059669",
  };

  const typeLabel = {
    emergency: "⚠ EMRG",
    walk_in: "WI",
    appointment: "APPT",
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h3 style={s.title}>Live Queue Board</h3>
        <div style={s.rightMeta}>
          <span style={{ ...s.dot, background: connected ? "#10b981" : "#f59e0b" }} />
          <span style={s.connLabel}>{connected ? "Live" : "Polling"}</span>
          <button style={s.refreshBtn} onClick={refetch} title="Refresh">↻</button>
        </div>
      </div>

      {loading ? (
        <div style={s.empty}>Loading queue…</div>
      ) : queue.length === 0 ? (
        <div style={s.empty}>No active tokens in queue.</div>
      ) : (
        <div style={s.body}>
          {Object.entries(grouped).map(([doctor, tokens]) => (
            <div key={doctor} style={s.group}>
              <div style={s.groupHeader}>{doctor}</div>
              <div style={s.tokenList}>
                {tokens.map((t, idx) => (
                  <div
                    key={t.id}
                    style={{
                      ...s.tokenRow,
                      background: t.type === "emergency" ? "#fef2f2" : idx === 0 ? "#f0fdf4" : "#fff",
                      borderLeft: `3px solid ${typeColor[t.type] || "#6b7280"}`,
                    }}
                  >
                    <span style={{ ...s.tokenNum, color: typeColor[t.type] || "#374151" }}>
                      {t.token_number}
                    </span>
                    <span style={s.tokenName}>{t.patient_name}</span>
                    {!compact && (
                      <span style={s.tokenTime}>
                        {new Date(t.issued_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <span
                      style={{
                        ...s.typePill,
                        background: typeColor[t.type] + "1a",
                        color: typeColor[t.type],
                      }}
                    >
                      {typeLabel[t.type] || t.type}
                    </span>
                    {idx === 0 && <span style={s.nowBadge}>NOW</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={s.footer}>
        Total: <strong>{queue.length}</strong> token{queue.length !== 1 ? "s" : ""}
        {" · "}
        Emergency: <strong style={{ color: "#dc2626" }}>
          {queue.filter(t => t.type === "emergency").length}
        </strong>
      </div>
    </div>
  );
};

const s = {
  wrap: {
    background: "#fff", borderRadius: 12,
    border: "1px solid #e5e7eb",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderBottom: "1px solid #f3f4f6",
  },
  title: { fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 },
  rightMeta: { display: "flex", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  connLabel: { fontSize: 12, color: "#6b7280" },
  refreshBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 16, color: "#6b7280", padding: "2px 6px",
  },
  body: { flex: 1, overflowY: "auto", maxHeight: 480, padding: "8px 0" },
  group: { marginBottom: 8 },
  groupHeader: {
    fontSize: 11, fontWeight: 700, color: "#9ca3af",
    textTransform: "uppercase", letterSpacing: "0.06em",
    padding: "6px 16px 4px",
  },
  tokenList: {},
  tokenRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 16px", borderBottom: "1px solid #f9fafb",
    transition: "background 0.1s",
  },
  tokenNum: { fontWeight: 900, fontSize: 17, minWidth: 48 },
  tokenName: { flex: 1, fontSize: 13, fontWeight: 500, color: "#111827" },
  tokenTime: { fontSize: 11, color: "#9ca3af", minWidth: 42 },
  typePill: {
    fontSize: 10, fontWeight: 700, padding: "2px 7px",
    borderRadius: 4, letterSpacing: "0.04em",
  },
  nowBadge: {
    fontSize: 10, fontWeight: 800, color: "#fff",
    background: "#10b981", padding: "2px 7px", borderRadius: 4,
  },
  empty: { padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 },
  footer: {
    padding: "10px 16px", borderTop: "1px solid #f3f4f6",
    fontSize: 12, color: "#6b7280",
  },
};

export default LiveQueueBoard;
