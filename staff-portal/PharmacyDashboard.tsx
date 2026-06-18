// src/pages/Dashboard/PharmacyDashboard.tsx
import { useEffect, useState } from "react";
import useStore from "../../store/useStore";

const API = import.meta.env.VITE_API_BASE_URL || "";

interface Prescription {
  id: string;
  patient_name: string;
  patient_id: string;
  doctor_name: string;
  medicines: { name: string; dosage: string; quantity: number }[];
  status: "PENDING" | "DISPENSED" | "PARTIAL";
  created_at: string;
}

interface Medicine {
  id: string;
  name: string;
  category: string;
  quantity: number;
  reorder_level: number;
  expiry_date: string;
  unit: string;
}

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function patch(url: string, token: string, body?: object) {
  const res = await fetch(`${API}${url}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    PENDING: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
    DISPENSED: { bg: "rgba(52,211,153,0.15)", color: "#34d399" },
    PARTIAL: { bg: "rgba(99,102,241,0.15)", color: "#818cf8" },
  };
  const c = colors[status] || { bg: "rgba(255,255,255,0.08)", color: "#94a3b8" };
  return (
    <span
      style={{
        ...c,
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}

export default function PharmacyDashboard() {
  const token = useStore((s) => s.token);
  const [tab, setTab] = useState<"prescriptions" | "inventory">("prescriptions");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispensing, setDispensing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    if (tab === "prescriptions") {
      get<Prescription[]>("/api/v1/prescriptions?status=PENDING&role=pharmacy", token)
        .then(setPrescriptions)
        .catch((e) => showToast(e.message, "error"))
        .finally(() => setLoading(false));
    } else {
      get<Medicine[]>("/api/v1/medicines", token)
        .then(setMedicines)
        .catch((e) => showToast(e.message, "error"))
        .finally(() => setLoading(false));
    }
  }, [token, tab]);

  const dispense = async (id: string) => {
    if (!token) return;
    setDispensing(id);
    try {
      await patch(`/api/v1/prescriptions/${id}/dispense`, token);
      setPrescriptions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "DISPENSED" } : p))
      );
      showToast("Prescription marked as dispensed ✓", "success");
    } catch (e: unknown) {
      showToast((e as Error).message, "error");
    } finally {
      setDispensing(null);
    }
  };

  const isExpiringSoon = (date: string) => {
    const d = new Date(date);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff < 30;
  };

  const lowStock = medicines.filter((m) => m.quantity <= m.reorder_level);
  const expiringSoon = medicines.filter((m) => isExpiringSoon(m.expiry_date));

  const cardStyle = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 12,
  };

  return (
    <div
      style={{
        padding: "28px 32px",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #060a14 0%, #0a1220 100%)",
        color: "#fff",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
      }}
    >
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: toast.type === "success" ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.type === "success" ? "rgba(52,211,153,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: toast.type === "success" ? "#34d399" : "#f87171",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 14,
            zIndex: 999,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: 0,
              background: "linear-gradient(90deg, #fff 60%, #0D9488)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Pharmacy Dashboard
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", margin: "6px 0 0", fontSize: 14 }}>
            Prescription queue & inventory management
          </p>
        </div>

        {/* Alert Badges */}
        <div style={{ display: "flex", gap: 10 }}>
          {lowStock.length > 0 && (
            <div
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#f87171",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ⚠ {lowStock.length} Low Stock
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div
              style={{
                background: "rgba(251,191,36,0.12)",
                border: "1px solid rgba(251,191,36,0.3)",
                color: "#fbbf24",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ⏰ {expiringSoon.length} Expiring Soon
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {(["prescriptions", "inventory"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              background: tab === t ? "rgba(13,148,136,0.2)" : "transparent",
              color: tab === t ? "#0D9488" : "rgba(255,255,255,0.4)",
              fontWeight: 600,
              fontSize: 14,
              textTransform: "capitalize",
              transition: "all 0.2s",
              borderBottom: tab === t ? "2px solid #0D9488" : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", paddingTop: 60 }}>
          Loading…
        </div>
      )}

      {/* Prescriptions Tab */}
      {!loading && tab === "prescriptions" && (
        <div>
          {prescriptions.length === 0 && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", paddingTop: 60, fontSize: 15 }}>
              No pending prescriptions
            </div>
          )}
          {prescriptions.map((rx) => (
            <div key={rx.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 3 }}>{rx.patient_name}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                    Dr. {rx.doctor_name} · {new Date(rx.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <StatusBadge status={rx.status} />
              </div>

              {/* Medicine list */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {rx.medicines.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
                      color: "#a5b4fc",
                    }}
                  >
                    {m.name} · {m.dosage} · ×{m.quantity}
                  </div>
                ))}
              </div>

              {rx.status === "PENDING" && (
                <button
                  onClick={() => dispense(rx.id)}
                  disabled={dispensing === rx.id}
                  style={{
                    background: dispensing === rx.id ? "rgba(255,255,255,0.06)" : "rgba(13,148,136,0.15)",
                    border: "1px solid rgba(13,148,136,0.4)",
                    color: dispensing === rx.id ? "rgba(255,255,255,0.3)" : "#0D9488",
                    padding: "8px 18px",
                    borderRadius: 8,
                    cursor: dispensing === rx.id ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    transition: "all 0.2s",
                  }}
                >
                  {dispensing === rx.id ? "Dispensing…" : "✓ Mark Dispensed"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inventory Tab */}
      {!loading && tab === "inventory" && (
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Medicine", "Category", "Stock", "Reorder Level", "Expiry", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "10px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medicines.map((m) => {
                const isLow = m.quantity <= m.reorder_level;
                const isExpiring = isExpiringSoon(m.expiry_date);
                return (
                  <tr
                    key={m.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 14 }}>{m.name}</td>
                    <td style={{ padding: "12px 14px", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{m.category}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ color: isLow ? "#f87171" : "#34d399", fontWeight: 700 }}>
                        {m.quantity}
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}> {m.unit}</span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{m.reorder_level}</td>
                    <td style={{ padding: "12px 14px", color: isExpiring ? "#fbbf24" : "rgba(255,255,255,0.45)", fontSize: 13 }}>
                      {new Date(m.expiry_date).toLocaleDateString("en-IN")}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {isLow && <span style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", padding: "2px 8px", borderRadius: 4, fontSize: 11, marginRight: 4 }}>LOW</span>}
                      {isExpiring && <span style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>EXPIRING</span>}
                      {!isLow && !isExpiring && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>OK</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {medicines.length === 0 && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", paddingTop: 60, fontSize: 15 }}>
              No inventory data
            </div>
          )}
        </div>
      )}
    </div>
  );
}
