/**
 * DoctorDashboard.jsx
 * Phase 3 Fix: Doctor App — Dashboard wired to all Phase 3 backend routes
 *
 * APPLY TO: doctor-app/src/pages/DoctorDashboard.jsx  (create or replace)
 *
 * What this does:
 *  - Loads /doctor/stats on mount
 *  - Shows alerts tab with /doctor/alerts
 *  - Break start/end buttons wired to /doctor/session/break/start|end
 *  - Emergency broadcast modal wired to POST /doctor/emergency/broadcast
 *  - Access history tab wired to /doctor/access-history
 */

import { useState, useEffect, useCallback } from "react";
import * as doctorService from "../services/doctorService";

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color = "#1e3a5f", icon }) {
  return (
    <div style={{
      background: "white", borderRadius: 10, padding: "16px 20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)", flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Alert Item ────────────────────────────────────────────────────────────
function AlertItem({ alert }) {
  const colors = {
    high: { bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
    medium: { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
    low: { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  };
  const c = colors[alert.severity] || colors.medium;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "12px 0", borderBottom: "1px solid #f3f4f6",
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot, flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{alert.title}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
          {alert.patient_name && <span style={{ marginRight: 8 }}>👤 {alert.patient_name}</span>}
          <span>{String(alert.created_at || "").slice(0, 16).replace("T", " ")}</span>
        </div>
      </div>
      <span style={{
        background: c.bg, color: c.text, borderRadius: 20,
        padding: "2px 8px", fontSize: 10, fontWeight: 600, flexShrink: 0,
      }}>
        {alert.severity?.toUpperCase()}
      </span>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const [tab, setTab] = useState("overview"); // overview | alerts | history
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState({ stats: true, alerts: false, history: false });
  const [onBreak, setOnBreak] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyMsg, setEmergencyMsg] = useState("");
  const [emergencyLocation, setEmergencyLocation] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Load stats on mount
  useEffect(() => {
    doctorService.getStats()
      .then((data) => {
        setStats(data);
        setOnBreak(data?.status === "on_break");
        setLoading((l) => ({ ...l, stats: false }));
      })
      .catch((e) => {
        setError(e.message);
        setLoading((l) => ({ ...l, stats: false }));
      });
  }, []);

  // Load alerts when tab selected
  const loadAlerts = useCallback(() => {
    setLoading((l) => ({ ...l, alerts: true }));
    doctorService.getAlerts()
      .then((data) => {
        setAlerts(data?.alerts || []);
        setLoading((l) => ({ ...l, alerts: false }));
      })
      .catch(() => setLoading((l) => ({ ...l, alerts: false })));
  }, []);

  // Load access history when tab selected
  const loadHistory = useCallback(() => {
    setLoading((l) => ({ ...l, history: true }));
    doctorService.getAccessHistory()
      .then((data) => {
        setHistory(data?.history || []);
        setLoading((l) => ({ ...l, history: false }));
      })
      .catch(() => setLoading((l) => ({ ...l, history: false })));
  }, []);

  useEffect(() => {
    if (tab === "alerts") loadAlerts();
    if (tab === "history") loadHistory();
  }, [tab]);

  // Break toggle
  const handleBreakToggle = async () => {
    try {
      if (onBreak) {
        await doctorService.endBreak();
        setOnBreak(false);
      } else {
        await doctorService.startBreak();
        setOnBreak(true);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // Emergency broadcast
  const handleEmergencyBroadcast = async () => {
    if (!emergencyMsg.trim()) return;
    setBroadcasting(true);
    try {
      await doctorService.broadcastEmergency({
        message: emergencyMsg,
        severity: "critical",
        location: emergencyLocation || undefined,
      });
      setBroadcastSuccess(true);
      setTimeout(() => {
        setShowEmergency(false);
        setBroadcastSuccess(false);
        setEmergencyMsg("");
        setEmergencyLocation("");
      }, 2000);
    } catch (e) {
      alert("Broadcast failed: " + e.message);
    } finally {
      setBroadcasting(false);
    }
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "alerts", label: `Alerts${alerts.length ? ` (${alerts.length})` : ""}` },
    { key: "history", label: "Access History" },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Good {new Date().getHours() < 12 ? "Morning" : "Afternoon"},{" "}
            Dr. {stats?.doctor_name?.split(" ")[0] || "..."}
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Break button */}
          <button
            onClick={handleBreakToggle}
            style={{
              padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: onBreak ? "#d1fae5" : "#fef3c7",
              color: onBreak ? "#065f46" : "#92400e",
              border: `1px solid ${onBreak ? "#a7f3d0" : "#fde68a"}`,
            }}>
            {onBreak ? "▶ End Break" : "⏸ Take Break"}
          </button>
          {/* Emergency button */}
          <button
            onClick={() => setShowEmergency(true)}
            style={{
              padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: "#dc2626", color: "white", border: "none",
            }}>
            🚨 Emergency
          </button>
        </div>
      </div>

      {onBreak && (
        <div style={{
          background: "#fef3c7", border: "1px solid #fde68a",
          borderRadius: 8, padding: "10px 16px", marginBottom: 20,
          color: "#92400e", fontSize: 13, fontWeight: 600,
        }}>
          ⏸ You are currently on break. Your queue is paused.
        </div>
      )}

      {/* Stats cards */}
      {loading.stats ? (
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {[1,2,3,4].map((i) => (
            <div key={i} style={{ flex: 1, height: 90, background: "#f3f4f6", borderRadius: 10 }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ background: "#fee2e2", borderRadius: 8, padding: 12, marginBottom: 20, color: "#991b1b", fontSize: 13 }}>
          ⚠️ Could not load stats: {error}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Patients Today" value={stats?.total_patients_today ?? "—"} icon="👥" />
          <StatCard label="Completed" value={stats?.consultations_completed ?? "—"} icon="✅" color="#065f46" />
          <StatCard label="In Queue" value={stats?.pending_queue_count ?? "—"} icon="⏳" color="#92400e" />
          <StatCard label="Avg. Time (min)" value={stats?.avg_consultation_time_minutes ?? "—"} icon="⏱️" color="#1e40af" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginBottom: 20 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px", background: "none", border: "none",
              borderBottom: tab === t.key ? "2px solid #1e3a5f" : "2px solid transparent",
              marginBottom: -2, cursor: "pointer", fontSize: 13, fontWeight: 600,
              color: tab === t.key ? "#1e3a5f" : "#6b7280",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#374151" }}>Today's Summary</h3>
          <div style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.8 }}>
            <div>Total patients booked: <strong>{stats?.total_patients_today ?? "—"}</strong></div>
            <div>Consultations completed: <strong>{stats?.consultations_completed ?? "—"}</strong></div>
            <div>Patients waiting: <strong>{stats?.pending_queue_count ?? "—"}</strong></div>
            <div>Average consultation time: <strong>{stats?.avg_consultation_time_minutes ?? "—"} min</strong></div>
            <div>Doctor status: <strong style={{ color: onBreak ? "#92400e" : "#065f46" }}>{onBreak ? "On Break" : "Active"}</strong></div>
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          {loading.alerts ? (
            <p style={{ color: "#6b7280" }}>Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
              <div style={{ fontSize: 36 }}>✅</div>
              <p>No pending alerts</p>
            </div>
          ) : (
            alerts.map((a) => <AlertItem key={a.ref_id} alert={a} />)
          )}
        </div>
      )}

      {tab === "history" && (
        <div style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          {loading.history ? (
            <p style={{ color: "#6b7280" }}>Loading history...</p>
          ) : history.length === 0 ? (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: 30 }}>No access history recorded yet.</p>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={th}>Action</th>
                  <th style={th}>Patient ID</th>
                  <th style={th}>IP Address</th>
                  <th style={th}>Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={td}>{h.action}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{h.patient_id?.slice(0, 12)}…</td>
                    <td style={td}>{h.ip_address || "—"}</td>
                    <td style={td}>{String(h.accessed_at || "").slice(0, 16).replace("T", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Emergency broadcast modal */}
      {showEmergency && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{ background: "white", borderRadius: 12, padding: 28, width: 420 }}>
            {broadcastSuccess ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 48 }}>📣</div>
                <h2 style={{ color: "#065f46" }}>Emergency Broadcast Sent!</h2>
                <p style={{ color: "#6b7280" }}>Reception and nursing staff have been notified.</p>
              </div>
            ) : (
              <>
                <h2 style={{ margin: "0 0 4px", color: "#dc2626" }}>🚨 Emergency Broadcast</h2>
                <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>
                  This message will be sent to all reception and nursing staff in this hospital immediately.
                </p>
                <label style={labelStyle}>Emergency Message *</label>
                <textarea rows={3} style={inputStyle}
                  placeholder="Describe the emergency clearly..."
                  value={emergencyMsg}
                  onChange={(e) => setEmergencyMsg(e.target.value)}
                />
                <label style={labelStyle}>Location (optional)</label>
                <input style={inputStyle} placeholder="e.g. Ward 3, Bed 12, OT 2"
                  value={emergencyLocation}
                  onChange={(e) => setEmergencyLocation(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button
                    onClick={handleEmergencyBroadcast}
                    disabled={broadcasting || !emergencyMsg.trim()}
                    style={{
                      flex: 1, background: "#dc2626", color: "white", border: "none",
                      borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 14, fontWeight: 700,
                      opacity: broadcasting || !emergencyMsg.trim() ? 0.6 : 1,
                    }}>
                    {broadcasting ? "Sending..." : "📣 Broadcast Emergency"}
                  </button>
                  <button
                    onClick={() => setShowEmergency(false)}
                    style={{
                      padding: "10px 16px", background: "white", color: "#374151",
                      border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 13,
                    }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const th = { textAlign: "left", padding: "8px 12px", color: "#6b7280", fontWeight: 600, fontSize: 12 };
const td = { padding: "8px 12px", color: "#374151" };
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, marginTop: 12 };
const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box", resize: "vertical" };
