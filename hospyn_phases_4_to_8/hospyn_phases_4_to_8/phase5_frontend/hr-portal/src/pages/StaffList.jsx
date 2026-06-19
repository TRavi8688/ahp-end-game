/**
 * StaffList.jsx
 * Phase 5 Fix: HR Portal — Staff Directory page
 *
 * APPLY TO: hr-portal/src/pages/StaffList.jsx
 */
import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const ROLE_LABELS = {
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  pharmacist: "Pharmacist",
  lab_technician: "Lab Technician",
  admin: "Admin",
  hr: "HR",
};

const STATUS_COLORS = {
  active: "#16a34a",
  inactive: "#dc2626",
  on_leave: "#d97706",
};

export default function StaffList() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_BASE}/api/v1/healthcare/staff`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load staff data");
        return r.json();
      })
      .then((data) => {
        setStaff(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = staff.filter((s) => {
    const matchSearch =
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    return matchSearch && matchRole;
  });

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={{ color: "#6b7280", marginTop: 12 }}>Loading staff directory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: "#dc2626" }}>⚠️ {error}</p>
        <button onClick={() => window.location.reload()} style={styles.btn}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Staff Directory</h1>
        <span style={styles.badge}>{filtered.length} staff members</span>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={styles.empty}>
          <p>No staff members found matching your filters.</p>
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.theadRow}>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Department</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={styles.row}>
                  <td style={styles.td}>
                    <div style={styles.nameCell}>
                      <div style={styles.avatar}>
                        {(s.name || "?")[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{s.name || "—"}</span>
                    </div>
                  </td>
                  <td style={styles.td}>{ROLE_LABELS[s.role] || s.role || "—"}</td>
                  <td style={styles.td}>{s.department || "—"}</td>
                  <td style={styles.td}>{s.email || "—"}</td>
                  <td style={styles.td}>{s.phone || "—"}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        color: STATUS_COLORS[s.status] || "#6b7280",
                        backgroundColor:
                          (STATUS_COLORS[s.status] || "#6b7280") + "1a",
                      }}
                    >
                      {s.status || "unknown"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: "24px", fontFamily: "system-ui, sans-serif", maxWidth: "1200px" },
  header: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" },
  title: { fontSize: "24px", fontWeight: "700", color: "#111827", margin: 0 },
  badge: { background: "#dbeafe", color: "#1d4ed8", padding: "2px 10px", borderRadius: "999px", fontSize: "13px", fontWeight: 600 },
  filters: { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  searchInput: { flex: 1, minWidth: "200px", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none" },
  select: { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", background: "#fff" },
  tableWrapper: { overflowX: "auto", borderRadius: "8px", border: "1px solid #e5e7eb" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
  theadRow: { background: "#f9fafb" },
  th: { padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" },
  row: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "12px 16px", color: "#374151", verticalAlign: "middle" },
  nameCell: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: { width: 32, height: 32, borderRadius: "50%", background: "#3b82f6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flexShrink: 0 },
  statusBadge: { padding: "2px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600 },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", gap: "12px" },
  spinner: { width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" },
  btn: { padding: "8px 16px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" },
  empty: { padding: "40px", textAlign: "center", color: "#9ca3af" },
};
