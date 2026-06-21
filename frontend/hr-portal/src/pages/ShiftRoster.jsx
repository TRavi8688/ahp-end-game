/**
 * ShiftRoster.jsx
 * Phase 3 Fix: HR Portal — Shift Roster page
 *
 * APPLY TO: hr-portal/src/pages/ShiftRoster.jsx  (create new file)
 */

import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const SHIFT_COLORS = {
  morning: { bg: "#fef3c7", text: "#92400e", label: "Morning (08:00–16:00)" },
  afternoon: { bg: "#dbeafe", text: "#1e40af", label: "Afternoon (14:00–22:00)" },
  night: { bg: "#ede9fe", text: "#5b21b6", label: "Night (22:00–08:00)" },
};

function getWeekDates(monday) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(d) {
  return d.toISOString().split("T")[0];
}

export default function ShiftRoster() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()));
  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({
    staff_id: "", shift_date: "", shift_type: "morning", department: ""
  });
  const [staffList, setStaffList] = useState([]);

  const weekDates = getWeekDates(weekStart);
  const token = localStorage.getItem("token");

  const fetchShifts = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/v1/staff/shifts?week_start=${formatDate(weekStart)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setShifts(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setShifts([]); setLoading(false); });
  };

  useEffect(() => { fetchShifts(); }, [weekStart]);

  useEffect(() => {
    // Fetch staff list for assign dropdown
    fetch(`${API_BASE}/api/v1/staff/list?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setStaffList(Array.isArray(data) ? data : []))
      .catch(() => setStaffList([]));
  }, []);

  const handleAssignShift = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/v1/staff/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(assignForm),
      });
      if (!r.ok) throw new Error("Failed to assign shift");
      setShowAssign(false);
      fetchShifts();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const getShiftsForDateAndType = (date, shiftType) =>
    shifts.filter((s) => s.shift_date === formatDate(date) && s.shift_type === shiftType);

  if (loading) return <div style={styles.center}><p>Loading shift roster...</p></div>;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={styles.title}>Shift Roster</h1>
          <p style={styles.subtitle}>
            Week of {weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btnSecondary} onClick={() => {
            const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(new Date(d));
          }}>← Prev</button>
          <button style={styles.btnSecondary} onClick={() => setWeekStart(getMondayOfWeek(new Date()))}>
            Today
          </button>
          <button style={styles.btnSecondary} onClick={() => {
            const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(new Date(d));
          }}>Next →</button>
          <button style={styles.btnPrimary} onClick={() => setShowAssign(true)}>+ Assign Shift</button>
        </div>
      </div>

      {/* Roster Grid */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <thead>
            <tr style={{ background: "#1e3a5f", color: "white" }}>
              <th style={styles.th}>Shift</th>
              {weekDates.map((d) => (
                <th key={d.toISOString()} style={styles.th}>
                  {d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(SHIFT_COLORS).map(([type, colors]) => (
              <tr key={type} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ ...styles.td, fontWeight: 600, background: colors.bg, color: colors.text, whiteSpace: "nowrap" }}>
                  {colors.label}
                </td>
                {weekDates.map((d) => {
                  const dayShifts = getShiftsForDateAndType(d, type);
                  return (
                    <td key={d.toISOString()} style={{ ...styles.td, verticalAlign: "top", minWidth: 100 }}>
                      {dayShifts.length === 0 ? (
                        <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                      ) : (
                        dayShifts.map((s) => (
                          <div key={s.id} style={{
                            background: colors.bg, color: colors.text,
                            borderRadius: 4, padding: "2px 6px", fontSize: 11,
                            marginBottom: 2, fontWeight: 500,
                          }}>
                            {s.staff_name}
                          </div>
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Shift Modal */}
      {showAssign && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={{ marginTop: 0 }}>Assign Shift</h2>
            <label style={styles.label}>Staff Member</label>
            <select style={styles.input}
              value={assignForm.staff_id}
              onChange={(e) => setAssignForm({ ...assignForm, staff_id: e.target.value })}>
              <option value="">Select staff...</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
            <label style={styles.label}>Date</label>
            <input type="date" style={styles.input}
              value={assignForm.shift_date}
              onChange={(e) => setAssignForm({ ...assignForm, shift_date: e.target.value })} />
            <label style={styles.label}>Shift Type</label>
            <select style={styles.input}
              value={assignForm.shift_type}
              onChange={(e) => setAssignForm({ ...assignForm, shift_type: e.target.value })}>
              <option value="morning">Morning (08:00–16:00)</option>
              <option value="afternoon">Afternoon (14:00–22:00)</option>
              <option value="night">Night (22:00–08:00)</option>
            </select>
            <label style={styles.label}>Department (optional)</label>
            <input style={styles.input} placeholder="e.g. Emergency, OPD"
              value={assignForm.department}
              onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={styles.btnPrimary} onClick={handleAssignShift}>Assign</button>
              <button style={styles.btnSecondary} onClick={() => setShowAssign(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 },
  subtitle: { color: "#6b7280", fontSize: 14, margin: "4px 0 0" },
  center: { display: "flex", justifyContent: "center", padding: 60 },
  th: { padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600 },
  td: { padding: "10px 12px", fontSize: 13 },
  btnPrimary: {
    background: "#1e3a5f", color: "white", border: "none",
    borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 13,
  },
  btnSecondary: {
    background: "white", color: "#374151",
    border: "1px solid #d1d5db", borderRadius: 6,
    padding: "8px 16px", cursor: "pointer", fontSize: 13,
  },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
  },
  modal: {
    background: "white", borderRadius: 12, padding: 28,
    minWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, marginTop: 12 },
  input: {
    width: "100%", padding: "8px 10px", border: "1px solid #d1d5db",
    borderRadius: 6, fontSize: 14, boxSizing: "border-box",
  },
};
