// src/pages/Dashboard/NurseDashboard.tsx
import { useEffect, useState } from "react";
import useStore from "../../store/useStore";

const API = import.meta.env.VITE_API_BASE_URL || "";

interface QueuePatient {
  id: string;
  patient_id: string;
  patient_name: string;
  age: number;
  gender: string;
  token_number: string;
  vitals_done: boolean;
  chief_complaint?: string;
  queue_time: string;
}

interface VitalsForm {
  systolic: string;
  diastolic: string;
  spo2: string;
  temperature: string;
  weight: string;
  height: string;
  pulse: string;
  notes: string;
}

const EMPTY_VITALS: VitalsForm = {
  systolic: "",
  diastolic: "",
  spo2: "",
  temperature: "",
  weight: "",
  height: "",
  pulse: "",
  notes: "",
};

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postVitals(patient_id: string, data: object, token: string) {
  const res = await fetch(`${API}/api/v1/nurse/vitals`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id, ...data }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function VitalInput({
  label,
  unit,
  value,
  name,
  onChange,
  placeholder,
}: {
  label: string;
  unit?: string;
  value: string;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
        {label} {unit && <span style={{ color: "rgba(255,255,255,0.2)" }}>({unit})</span>}
      </label>
      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "9px 12px",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

export default function NurseDashboard() {
  const token = useStore((s) => s.token);
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null);
  const [form, setForm] = useState<VitalsForm>(EMPTY_VITALS);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    get<QueuePatient[]>("/api/v1/nurse/queue", token)
      .then(setQueue)
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const openVitalsForm = (patient: QueuePatient) => {
    setSelectedPatient(patient);
    setForm(EMPTY_VITALS);
  };

  const closeForm = () => {
    setSelectedPatient(null);
    setForm(EMPTY_VITALS);
  };

  const submitVitals = async () => {
    if (!token || !selectedPatient) return;
    const { systolic, diastolic, spo2, temperature } = form;
    if (!systolic || !diastolic || !spo2 || !temperature) {
      showToast("BP, SpO2, and Temperature are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      await postVitals(selectedPatient.patient_id, {
        blood_pressure_systolic: Number(systolic),
        blood_pressure_diastolic: Number(diastolic),
        spo2: Number(spo2),
        temperature: Number(temperature),
        weight_kg: form.weight ? Number(form.weight) : undefined,
        height_cm: form.height ? Number(form.height) : undefined,
        pulse: form.pulse ? Number(form.pulse) : undefined,
        notes: form.notes || undefined,
      }, token);
      setQueue((prev) =>
        prev.map((p) =>
          p.patient_id === selectedPatient.patient_id ? { ...p, vitals_done: true } : p
        )
      );
      showToast(`Vitals recorded for ${selectedPatient.patient_name} ✓`, "success");
      closeForm();
    } catch (e: unknown) {
      showToast((e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = queue.filter((p) => !p.vitals_done).length;

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
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Vitals Modal */}
      {selectedPatient && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => e.target === e.currentTarget && closeForm()}
        >
          <div
            style={{
              background: "#0d1526",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: 28,
              width: 480,
              maxWidth: "95vw",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Record Vitals</h2>
                <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
                  {selectedPatient.patient_name} · Token {selectedPatient.token_number}
                </p>
              </div>
              <button
                onClick={closeForm}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 20 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <VitalInput label="Systolic BP" unit="mmHg" name="systolic" value={form.systolic} onChange={handleChange} placeholder="120" />
              <VitalInput label="Diastolic BP" unit="mmHg" name="diastolic" value={form.diastolic} onChange={handleChange} placeholder="80" />
              <VitalInput label="SpO2" unit="%" name="spo2" value={form.spo2} onChange={handleChange} placeholder="98" />
              <VitalInput label="Temperature" unit="°C" name="temperature" value={form.temperature} onChange={handleChange} placeholder="37.0" />
              <VitalInput label="Weight" unit="kg" name="weight" value={form.weight} onChange={handleChange} placeholder="Optional" />
              <VitalInput label="Height" unit="cm" name="height" value={form.height} onChange={handleChange} placeholder="Optional" />
              <div style={{ gridColumn: "1 / -1" }}>
                <VitalInput label="Pulse" unit="bpm" name="pulse" value={form.pulse} onChange={handleChange} placeholder="Optional" />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 600, display: "block", marginBottom: 5 }}>
                Notes (optional)
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Any observations…"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "9px 12px",
                  color: "#fff",
                  fontSize: 14,
                  width: "100%",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={submitVitals}
                disabled={submitting}
                style={{
                  flex: 1,
                  background: submitting ? "rgba(255,255,255,0.06)" : "rgba(13,148,136,0.2)",
                  border: "1px solid rgba(13,148,136,0.5)",
                  color: submitting ? "rgba(255,255,255,0.3)" : "#0D9488",
                  padding: "11px",
                  borderRadius: 10,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {submitting ? "Saving…" : "Save Vitals"}
              </button>
              <button
                onClick={closeForm}
                style={{
                  padding: "11px 20px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
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
              background: "linear-gradient(90deg, #fff 60%, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Nurse Dashboard
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", margin: "6px 0 0", fontSize: 14 }}>
            Vitals queue — {pendingCount} patient{pendingCount !== 1 ? "s" : ""} awaiting vitals
          </p>
        </div>
        <div style={{ background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.3)", color: "#0D9488", padding: "8px 16px", borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
          {queue.length} in queue
        </div>
      </div>

      {loading && (
        <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", paddingTop: 60 }}>Loading queue…</div>
      )}

      {!loading && queue.length === 0 && (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", paddingTop: 60, fontSize: 15 }}>
          Queue is empty
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {queue.map((patient) => (
          <div
            key={patient.id}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${patient.vitals_done ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 12,
              padding: "16px 18px",
              opacity: patient.vitals_done ? 0.6 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "rgba(13,148,136,0.15)",
                  border: "1px solid rgba(13,148,136,0.3)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  color: "#0D9488",
                  fontSize: 14,
                }}
              >
                {patient.token_number}
              </div>
              {patient.vitals_done ? (
                <span style={{ color: "#34d399", fontSize: 12, fontWeight: 600 }}>✓ Done</span>
              ) : (
                <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 600 }}>Pending</span>
              )}
            </div>

            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{patient.patient_name}</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 8 }}>
              {patient.age}y · {patient.gender}
              {patient.chief_complaint && ` · ${patient.chief_complaint}`}
            </div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginBottom: 12 }}>
              Arrived {new Date(patient.queue_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </div>

            {!patient.vitals_done && (
              <button
                onClick={() => openVitalsForm(patient)}
                style={{
                  width: "100%",
                  background: "rgba(13,148,136,0.12)",
                  border: "1px solid rgba(13,148,136,0.35)",
                  color: "#0D9488",
                  padding: "9px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Record Vitals
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
