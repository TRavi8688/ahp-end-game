import { useState, useEffect } from "react";
import { getAllDoctors } from "../../services/receptionApi";

/**
 * DoctorAvailabilityView
 * Props:
 *   hospitalId
 */
const DoctorAvailabilityView = ({ hospitalId }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!hospitalId) return;
    getAllDoctors(hospitalId)
      .then((data) => setDoctors(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hospitalId]);

  const filtered =
    filter === "all"
      ? doctors
      : doctors.filter((d) => (filter === "available" ? d.is_available : !d.is_available));

  const statusColor = (d) => (d.is_available ? "#059669" : "#6b7280");
  const statusLabel = (d) => (d.is_available ? "Available" : "Unavailable");

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h3 style={s.title}>Doctor Availability</h3>
        <div style={s.filters}>
          {["all", "available", "unavailable"].map((f) => (
            <button
              key={f}
              style={{
                ...s.filterBtn,
                background: filter === f ? "#eff6ff" : "transparent",
                color: filter === f ? "#1d4ed8" : "#6b7280",
                fontWeight: filter === f ? 700 : 400,
                border: `1.5px solid ${filter === f ? "#bfdbfe" : "#e5e7eb"}`,
              }}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={s.empty}>Loading doctors…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No doctors found.</div>
      ) : (
        <div style={s.grid}>
          {filtered.map((d) => (
            <div key={d.id} style={s.card}>
              <div
                style={{
                  ...s.avatar,
                  background: d.is_available ? "#dbeafe" : "#f3f4f6",
                  color: d.is_available ? "#1d4ed8" : "#6b7280",
                }}
              >
                {d.name.charAt(0)}
              </div>
              <div style={s.info}>
                <div style={s.name}>Dr. {d.name}</div>
                <div style={s.specialty}>{d.specialty || d.department || "General"}</div>
              </div>
              <div style={s.right}>
                <span
                  style={{
                    ...s.statusPill,
                    background: d.is_available ? "#dcfce7" : "#f3f4f6",
                    color: statusColor(d),
                  }}
                >
                  {statusLabel(d)}
                </span>
                {d.is_available && (
                  <div style={s.queueCount}>
                    {d.queue_length ?? 0} waiting
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const s = {
  wrap: {
    background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderBottom: "1px solid #f3f4f6", flexWrap: "wrap", gap: 10,
  },
  title: { fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 },
  filters: { display: "flex", gap: 6 },
  filterBtn: {
    padding: "5px 12px", borderRadius: 6, cursor: "pointer",
    fontSize: 12, transition: "all 0.15s",
  },
  grid: { display: "flex", flexDirection: "column", gap: 0 },
  card: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 16px", borderBottom: "1px solid #f9fafb",
  },
  avatar: {
    width: 38, height: 38, borderRadius: "50%",
    fontSize: 16, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: 600, color: "#111827" },
  specialty: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  right: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 },
  statusPill: {
    fontSize: 11, fontWeight: 600, padding: "3px 9px",
    borderRadius: 20, letterSpacing: "0.03em",
  },
  queueCount: { fontSize: 11, color: "#6b7280" },
  empty: { padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 },
};

export default DoctorAvailabilityView;
