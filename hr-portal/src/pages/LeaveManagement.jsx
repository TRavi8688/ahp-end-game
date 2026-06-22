/**
 * LeaveManagement.jsx
 * Phase 3 Fix: HR Portal — Leave Request management page
 *
 * APPLY TO: hr-portal/src/pages/LeaveManagement.jsx  (create new file)
 */

import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const STATUS_STYLES = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  approved: { bg: "#d1fae5", text: "#065f46" },
  rejected: { bg: "#fee2e2", text: "#991b1b" },
};

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionModal, setActionModal] = useState(null); // { leaveId, staffName, action }
  const [remarks, setRemarks] = useState("");
  const token = localStorage.getItem("token");

  const fetchLeaves = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/v1/staff/leaves?status=${statusFilter}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setLeaves(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setLeaves([]); setLoading(false); });
  };

  useEffect(() => { fetchLeaves(); }, [statusFilter]);

  const handleAction = async (leaveId, approved) => {
    try {
      const r = await fetch(`${API_BASE}/api/v1/staff/leaves/${leaveId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approved, remarks }),
      });
      if (!r.ok) throw new Error("Action failed");
      setActionModal(null);
      setRemarks("");
      fetchLeaves();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const daysBetween = (start, end) => {
    const d1 = new Date(start), d2 = new Date(end);
    return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  };

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Leave Requests</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {["pending", "approved", "rejected"].map((s) => (
            <button key={s}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                background: statusFilter === s ? "#1e3a5f" : "white",
                color: statusFilter === s ? "white" : "#374151",
                border: `1px solid ${statusFilter === s ? "#1e3a5f" : "#d1d5db"}`,
                textTransform: "capitalize",
              }}
              onClick={() => setStatusFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {leaves.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
          <div style={{ fontSize: 40 }}>📭</div>
          <p>No {statusFilter} leave requests</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {leaves.map((leave) => {
            const s = STATUS_STYLES[leave.status] || STATUS_STYLES.pending;
            return (
              <div key={leave.id} style={{
                background: "white", borderRadius: 8, padding: "16px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: "#111827", fontSize: 15 }}>{leave.staff_name}</span>
                    <span style={{
                      background: s.bg, color: s.text,
                      borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600,
                    }}>
                      {leave.status?.toUpperCase()}
                    </span>
                    <span style={{
                      background: "#f3f4f6", color: "#374151",
                      borderRadius: 20, padding: "2px 10px", fontSize: 11,
                    }}>
                      {leave.leave_type?.replace("_", " ")}
                    </span>
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 4 }}>
                    📅 {leave.start_date} → {leave.end_date}
                    <span style={{ marginLeft: 8, color: "#374151", fontWeight: 600 }}>
                      ({daysBetween(leave.start_date, leave.end_date)} days)
                    </span>
                  </div>
                  {leave.reason && (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      💬 {leave.reason}
                    </div>
                  )}
                  {leave.approved_by && (
                    <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                      Actioned by: {leave.approved_by}
                    </div>
                  )}
                </div>
                {leave.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => setActionModal({ leaveId: leave.id, staffName: leave.staff_name, action: "approve" })}
                      style={{
                        background: "#d1fae5", color: "#065f46",
                        border: "1px solid #a7f3d0", borderRadius: 6,
                        padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                      }}>
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => setActionModal({ leaveId: leave.id, staffName: leave.staff_name, action: "reject" })}
                      style={{
                        background: "#fee2e2", color: "#991b1b",
                        border: "1px solid #fca5a5", borderRadius: 6,
                        padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                      }}>
                      ✗ Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div style={{
            background: "white", borderRadius: 12, padding: 28,
            minWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <h2 style={{ marginTop: 0, textTransform: "capitalize" }}>
              {actionModal.action} Leave Request
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14 }}>
              {actionModal.action === "approve" ? "Approve" : "Reject"} leave for{" "}
              <strong>{actionModal.staffName}</strong>?
            </p>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Remarks (optional)
            </label>
            <textarea
              rows={3}
              style={{
                width: "100%", padding: "8px 10px",
                border: "1px solid #d1d5db", borderRadius: 6,
                fontSize: 14, boxSizing: "border-box", resize: "vertical",
              }}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add a note (optional)..."
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                style={{
                  background: actionModal.action === "approve" ? "#1e3a5f" : "#dc2626",
                  color: "white", border: "none", borderRadius: 6,
                  padding: "8px 16px", cursor: "pointer", fontSize: 13,
                }}
                onClick={() => handleAction(actionModal.leaveId, actionModal.action === "approve")}>
                Confirm {actionModal.action}
              </button>
              <button
                style={{
                  background: "white", color: "#374151",
                  border: "1px solid #d1d5db", borderRadius: 6,
                  padding: "8px 16px", cursor: "pointer", fontSize: 13,
                }}
                onClick={() => { setActionModal(null); setRemarks(""); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
