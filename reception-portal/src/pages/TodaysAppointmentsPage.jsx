import { useState, useEffect } from "react";
import { getTodaysAppointments, checkInAppointment } from "../services/receptionApi";
import { useAuth } from "../hooks/useAuth";

const TodaysAppointmentsPage = () => {
  const { user } = useAuth();
  const hospitalId = user?.hospital_id;

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkingIn, setCheckingIn] = useState(null); // appointment id

  const fetchAppointments = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const data = await getTodaysAppointments(hospitalId);
      setAppointments(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(); }, [hospitalId]);

  const handleCheckIn = async (appt) => {
    setCheckingIn(appt.id);
    try {
      await checkInAppointment(appt.id);
      setAppointments((prev) =>
        prev.map((a) => a.id === appt.id ? { ...a, status: "checked_in" } : a)
      );
    } catch (e) {
      alert("Check-in failed: " + e.message);
    } finally {
      setCheckingIn(null);
    }
  };

  const statusColor = {
    scheduled: "#2563eb",
    checked_in: "#059669",
    in_progress: "#d97706",
    completed: "#6b7280",
    cancelled: "#dc2626",
  };

  const statusLabel = {
    scheduled: "Scheduled",
    checked_in: "Checked In",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  const byHour = appointments.reduce((acc, a) => {
    const h = new Date(a.scheduled_time).getHours();
    const key = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Today's Appointments</h1>
          <p style={s.subtitle}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={s.stats}>
          <Stat label="Total" value={appointments.length} color="#111827" />
          <Stat label="Scheduled" value={appointments.filter(a => a.status === "scheduled").length} color="#2563eb" />
          <Stat label="Checked In" value={appointments.filter(a => a.status === "checked_in").length} color="#059669" />
        </div>
        <button style={s.refreshBtn} onClick={fetchAppointments}>↻ Refresh</button>
      </div>

      {error && <div style={s.error}>Error: {error}</div>}

      {loading ? (
        <div style={s.empty}>Loading appointments…</div>
      ) : appointments.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📅</div>
          <div>No appointments scheduled for today.</div>
        </div>
      ) : (
        ["Morning", "Afternoon", "Evening"].map((period) => {
          const list = byHour[period];
          if (!list || list.length === 0) return null;
          return (
            <div key={period} style={s.section}>
              <div style={s.periodHeader}>{period} · {list.length} appointment{list.length !== 1 ? "s" : ""}</div>
              <div style={s.table}>
                <div style={s.tableHeader}>
                  <span>Time</span>
                  <span>Patient</span>
                  <span>Doctor</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>
                {list.map((a) => (
                  <div key={a.id} style={s.tableRow}>
                    <span style={s.time}>
                      {new Date(a.scheduled_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span style={s.patientCell}>
                      <div style={s.pName}>{a.patient_name}</div>
                      <div style={s.pPhone}>{a.patient_phone}</div>
                    </span>
                    <span style={s.doctorCell}>
                      <div style={s.dName}>Dr. {a.doctor_name}</div>
                      <div style={s.dDept}>{a.department}</div>
                    </span>
                    <span>
                      <span
                        style={{
                          ...s.statusPill,
                          background: (statusColor[a.status] || "#6b7280") + "1a",
                          color: statusColor[a.status] || "#6b7280",
                        }}
                      >
                        {statusLabel[a.status] || a.status}
                      </span>
                    </span>
                    <span>
                      {a.status === "scheduled" && (
                        <button
                          style={s.checkInBtn}
                          onClick={() => handleCheckIn(a)}
                          disabled={checkingIn === a.id}
                        >
                          {checkingIn === a.id ? "…" : "Check In"}
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

const Stat = ({ label, value, color }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{label}</div>
  </div>
);

const s = {
  page: { padding: "24px 20px", maxWidth: 1000, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "flex-start", gap: 20,
    marginBottom: 24, flexWrap: "wrap",
  },
  title: { fontSize: 24, fontWeight: 800, color: "#111827", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  stats: {
    display: "flex", gap: 20, marginLeft: "auto",
    background: "#f9fafb", borderRadius: 10, padding: "12px 20px",
    border: "1px solid #e5e7eb",
  },
  refreshBtn: {
    padding: "8px 16px", border: "1.5px solid #e5e7eb",
    borderRadius: 8, background: "#fff", cursor: "pointer",
    fontSize: 13, color: "#374151",
    alignSelf: "flex-start",
  },
  error: {
    padding: "12px 16px", background: "#fef2f2", color: "#dc2626",
    borderRadius: 8, marginBottom: 16, fontSize: 14,
  },
  empty: { padding: 60, textAlign: "center", color: "#9ca3af" },
  emptyCard: {
    background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb",
    padding: 60, textAlign: "center", color: "#6b7280", fontSize: 15,
  },
  section: { marginBottom: 24 },
  periodHeader: {
    fontSize: 12, fontWeight: 700, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.07em",
    marginBottom: 10, paddingLeft: 4,
  },
  table: {
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden",
  },
  tableHeader: {
    display: "grid", gridTemplateColumns: "80px 1fr 1fr 120px 100px",
    padding: "10px 16px", borderBottom: "1px solid #e5e7eb",
    fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase",
    letterSpacing: "0.05em", background: "#f9fafb", gap: 12,
  },
  tableRow: {
    display: "grid", gridTemplateColumns: "80px 1fr 1fr 120px 100px",
    padding: "12px 16px", borderBottom: "1px solid #f3f4f6",
    alignItems: "center", gap: 12,
    transition: "background 0.1s",
  },
  time: { fontSize: 14, fontWeight: 700, color: "#374151" },
  patientCell: {},
  pName: { fontSize: 14, fontWeight: 600, color: "#111827" },
  pPhone: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  doctorCell: {},
  dName: { fontSize: 13, fontWeight: 500, color: "#374151" },
  dDept: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  statusPill: {
    fontSize: 12, fontWeight: 600, padding: "4px 10px",
    borderRadius: 6, display: "inline-block",
  },
  checkInBtn: {
    padding: "6px 14px", border: "none",
    borderRadius: 6, background: "#1d4ed8", color: "#fff",
    cursor: "pointer", fontSize: 12, fontWeight: 600,
  },
};

export default TodaysAppointmentsPage;
