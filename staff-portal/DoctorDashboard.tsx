// src/pages/Dashboard/DoctorDashboard.tsx
import { useEffect, useState } from "react";
import useStore from "../../store/useStore";

const API = import.meta.env.VITE_API_BASE_URL || "";

interface QueueEntry {
  id: string;
  patient_id: string;
  patient_name: string;
  age: number;
  gender: string;
  token_number: string;
  chief_complaint?: string;
  vitals?: {
    bp: string;
    spo2: number;
    temperature: number;
    pulse: number;
  };
  status: "WAITING" | "IN_CONSULTATION" | "DONE";
  queue_time: string;
}

interface MedicineEntry {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post(url: string, token: string, body: object) {
  const res = await fetch(`${API}${url}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const EMPTY_MED: MedicineEntry = { name: "", dosage: "", frequency: "1-0-1", duration: "5 days", instructions: "" };

export default function DoctorDashboard() {
  const token = useStore((s) => s.token);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<QueueEntry | null>(null);
  const [notes, setNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [medicines, setMedicines] = useState<MedicineEntry[]>([{ ...EMPTY_MED }]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    get<QueueEntry[]>("/api/v1/doctor-queue/today", token)
      .then(setQueue)
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [token]);

  const openConsult = (p: QueueEntry) => {
    setSelectedPatient(p);
    setNotes("");
    setDiagnosis("");
    setMedicines([{ ...EMPTY_MED }]);
  };

  const closeConsult = () => setSelectedPatient(null);

  const addMedicine = () => setMedicines((prev) => [...prev, { ...EMPTY_MED }]);
  const removeMedicine = (i: number) => setMedicines((prev) => prev.filter((_, idx) => idx !== i));
  const updateMed = (i: number, field: keyof MedicineEntry, value: string) => {
    setMedicines((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  };

  const submitPrescription = async () => {
    if (!token || !selectedPatient) return;
    if (!diagnosis) { showToast("Diagnosis is required", "error"); return; }
    if (medicines.some((m) => !m.name)) { showToast("Fill all medicine names", "error"); return; }
    setSubmitting(true);
    try {
      await post("/api/v1/prescriptions", token, {
        patient_id: selectedPatient.patient_id,
        diagnosis,
        clinical_notes: notes,
        medicines,
      });
      setQueue((prev) =>
        prev.map((p) => (p.patient_id === selectedPatient.patient_id ? { ...p, status: "DONE" } : p))
      );
      showToast(`Prescription saved for ${selectedPatient.patient_name} ✓`, "success");
      closeConsult();
    } catch (e: unknown) {
      showToast((e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    WAITING: "#fbbf24",
    IN_CONSULTATION: "#60a5fa",
    DONE: "#34d399",
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7,
    padding: "7px 10px",
    color: "#fff",
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
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
            position: "fixed", top: 20, right: 20,
            background: toast.type === "success" ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${toast.type === "success" ? "rgba(52,211,153,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: toast.type === "success" ? "#34d399" : "#f87171",
            padding: "12px 20px", borderRadius: 10, fontSize: 14, zIndex: 999,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Prescription Modal */}
      {selectedPatient && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && closeConsult()}
        >
          <div
            style={{
              background: "#0d1526",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: 28,
              width: 620,
              maxWidth: "95vw",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Consultation</h2>
                <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
                  {selectedPatient.patient_name} · {selectedPatient.age}y {selectedPatient.gender} · Token {selectedPatient.token_number}
                </p>
              </div>
              <button onClick={closeConsult} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 22 }}>×</button>
            </div>

            {/* Vitals if available */}
            {selectedPatient.vitals && (
              <div
                style={{
                  background: "rgba(13,148,136,0.08)",
                  border: "1px solid rgba(13,148,136,0.2)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  marginBottom: 18,
                  display: "flex",
                  gap: 24,
                  flexWrap: "wrap",
                }}
              >
                {[
                  { label: "BP", val: selectedPatient.vitals.bp },
                  { label: "SpO2", val: `${selectedPatient.vitals.spo2}%` },
                  { label: "Temp", val: `${selectedPatient.vitals.temperature}°C` },
                  { label: "Pulse", val: `${selectedPatient.vitals.pulse} bpm` },
                ].map((v) => (
                  <div key={v.label}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>{v.label}</div>
                    <div style={{ fontWeight: 700, color: "#0D9488" }}>{v.val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Diagnosis */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                Diagnosis *
              </label>
              <input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Primary diagnosis…"
                style={inputStyle}
              />
            </div>

            {/* Clinical Notes */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                Clinical Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Findings, symptoms, history…"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {/* Medicines */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Medicines
                </label>
                <button
                  onClick={addMedicine}
                  style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  + Add
                </button>
              </div>

              {medicines.map((med, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}>Medicine Name *</label>
                      <input value={med.name} onChange={(e) => updateMed(i, "name", e.target.value)} placeholder="e.g. Paracetamol 500mg" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}>Dosage</label>
                      <input value={med.dosage} onChange={(e) => updateMed(i, "dosage", e.target.value)} placeholder="500mg" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}>Frequency</label>
                      <input value={med.frequency} onChange={(e) => updateMed(i, "frequency", e.target.value)} placeholder="1-0-1" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}>Duration</label>
                      <input value={med.duration} onChange={(e) => updateMed(i, "duration", e.target.value)} placeholder="5 days" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}>Instructions</label>
                      <input value={med.instructions} onChange={(e) => updateMed(i, "instructions", e.target.value)} placeholder="After food, with water…" style={inputStyle} />
                    </div>
                    {medicines.length > 1 && (
                      <button onClick={() => removeMedicine(i)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={submitPrescription}
                disabled={submitting}
                style={{
                  flex: 1,
                  background: submitting ? "rgba(255,255,255,0.06)" : "rgba(13,148,136,0.2)",
                  border: "1px solid rgba(13,148,136,0.5)",
                  color: submitting ? "rgba(255,255,255,0.3)" : "#0D9488",
                  padding: "12px",
                  borderRadius: 10,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {submitting ? "Saving…" : "Save Prescription"}
              </button>
              <button onClick={closeConsult} style={{ padding: "12px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: "linear-gradient(90deg, #fff 60%, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Doctor Dashboard
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", margin: "6px 0 0", fontSize: 14 }}>
          Today's consultation queue
        </p>
      </div>

      {loading && <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", paddingTop: 60 }}>Loading queue…</div>}

      {!loading && queue.length === 0 && (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", paddingTop: 60, fontSize: 15 }}>No patients in queue</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {queue.map((p) => (
          <div
            key={p.id}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ width: 38, height: 38, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#60a5fa", fontSize: 14, flexShrink: 0 }}>
              {p.token_number}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.patient_name}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                {p.age}y · {p.gender}{p.chief_complaint && ` · ${p.chief_complaint}`}
              </div>
            </div>
            {p.vitals && (
              <div style={{ display: "flex", gap: 12, color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                <span>BP {p.vitals.bp}</span>
                <span>SpO2 {p.vitals.spo2}%</span>
                <span>{p.vitals.temperature}°C</span>
              </div>
            )}
            <div style={{ color: statusColors[p.status], fontSize: 12, fontWeight: 700, width: 90, textAlign: "right" }}>
              {p.status.replace("_", " ")}
            </div>
            {p.status !== "DONE" && (
              <button
                onClick={() => openConsult(p)}
                style={{
                  background: "rgba(96,165,250,0.1)",
                  border: "1px solid rgba(96,165,250,0.3)",
                  color: "#60a5fa",
                  padding: "8px 16px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Consult
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
