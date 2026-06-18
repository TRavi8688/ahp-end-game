// src/pages/Dashboard/LabDashboard.tsx
import { useEffect, useRef, useState } from "react";
import useStore from "../../store/useStore";

const API = import.meta.env.VITE_API_BASE_URL || "";

interface LabOrder {
  id: string;
  patient_name: string;
  patient_id: string;
  doctor_name: string;
  test_name: string;
  test_code: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  ordered_at: string;
  result_url?: string;
}

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function patchStatus(id: string, status: string, token: string) {
  const res = await fetch(`${API}/api/v1/lab-results/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function uploadResult(id: string, file: File, token: string) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API}/api/v1/lab-results/${id}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

const PRIORITY_COLOR: Record<string, { bg: string; color: string }> = {
  STAT: { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
  URGENT: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  ROUTINE: { bg: "rgba(148,163,184,0.1)", color: "#94a3b8" },
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  IN_PROGRESS: { bg: "rgba(99,102,241,0.15)", color: "#818cf8" },
  COMPLETED: { bg: "rgba(52,211,153,0.15)", color: "#34d399" },
  CANCELLED: { bg: "rgba(239,68,68,0.08)", color: "#6b7280" },
};

function Badge({ label, style }: { label: string; style: { bg: string; color: string } }) {
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        padding: "3px 9px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

export default function LabDashboard() {
  const token = useStore((s) => s.token);
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const query = filterStatus === "ALL" ? "" : `?status=${filterStatus}`;
    get<LabOrder[]>(`/api/v1/lab-results${query}`, token)
      .then(setOrders)
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [token, filterStatus]);

  const markComplete = async (id: string) => {
    if (!token) return;
    setCompleting(id);
    try {
      await patchStatus(id, "COMPLETED", token);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: "COMPLETED" } : o))
      );
      showToast("Lab order marked as completed ✓", "success");
    } catch (e: unknown) {
      showToast((e as Error).message, "error");
    } finally {
      setCompleting(null);
    }
  };

  const triggerUpload = (id: string) => {
    uploadTargetRef.current = id;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = uploadTargetRef.current;
    if (!file || !id || !token) return;
    setUploading(id);
    try {
      const result = await uploadResult(id, file, token);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, result_url: result.url, status: "COMPLETED" } : o
        )
      );
      showToast("Result uploaded successfully ✓", "success");
    } catch (e: unknown) {
      showToast((e as Error).message, "error");
    } finally {
      setUploading(null);
      uploadTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const statuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "ALL"];
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const statCount = orders.filter((o) => o.priority === "STAT").length;

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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

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
              background: "linear-gradient(90deg, #fff 60%, #6366F1)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Lab Dashboard
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", margin: "6px 0 0", fontSize: 14 }}>
            Lab orders, results, and reports
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {pendingCount > 0 && (
            <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              ⏳ {pendingCount} Pending
            </div>
          )}
          {statCount > 0 && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              🚨 {statCount} STAT
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: "7px 16px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              background: filterStatus === s ? "rgba(99,102,241,0.2)" : "transparent",
              color: filterStatus === s ? "#818cf8" : "rgba(255,255,255,0.4)",
              fontWeight: 600,
              fontSize: 13,
              transition: "all 0.2s",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", paddingTop: 60 }}>Loading…</div>
      )}

      {!loading && orders.length === 0 && (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", paddingTop: 60, fontSize: 15 }}>
          No lab orders found
        </div>
      )}

      {!loading &&
        orders.map((order) => (
          <div
            key={order.id}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${order.priority === "STAT" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {order.test_name}
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginLeft: 8 }}>
                    #{order.test_code}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                  {order.patient_name} · Dr. {order.doctor_name} ·{" "}
                  {new Date(order.ordered_at).toLocaleString("en-IN", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge label={order.priority} style={PRIORITY_COLOR[order.priority]} />
                <Badge label={order.status} style={STATUS_COLOR[order.status]} />
              </div>
            </div>

            {/* Actions */}
            {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => markComplete(order.id)}
                  disabled={completing === order.id}
                  style={{
                    background: "rgba(52,211,153,0.1)",
                    border: "1px solid rgba(52,211,153,0.3)",
                    color: "#34d399",
                    padding: "7px 16px",
                    borderRadius: 8,
                    cursor: completing === order.id ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {completing === order.id ? "Marking…" : "✓ Mark Complete"}
                </button>
                <button
                  onClick={() => triggerUpload(order.id)}
                  disabled={uploading === order.id}
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    color: "#818cf8",
                    padding: "7px 16px",
                    borderRadius: 8,
                    cursor: uploading === order.id ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {uploading === order.id ? "Uploading…" : "📎 Upload Result"}
                </button>
              </div>
            )}

            {order.result_url && (
              <a
                href={order.result_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  color: "#60a5fa",
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                📄 View Result PDF →
              </a>
            )}
          </div>
        ))}
    </div>
  );
}
