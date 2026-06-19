import { useState, useEffect } from "react";
import { getAvailableDoctors, getDepartments, issueToken } from "../../services/receptionApi";
import { printToken } from "../../utils/printToken";

/**
 * TokenAssignmentModal
 * Props:
 *   patient    — selected patient object
 *   hospitalId — current hospital id (from user context)
 *   onSuccess(token) — token object returned from backend
 *   onCancel()
 */
const TokenAssignmentModal = ({ patient, hospitalId, onSuccess, onCancel }) => {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [tokenType, setTokenType] = useState("walk_in");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [issuedToken, setIssuedToken] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docs, depts] = await Promise.all([
          getAvailableDoctors(hospitalId),
          getDepartments(hospitalId),
        ]);
        setDoctors(docs || []);
        setDepartments(depts || []);
      } catch (e) {
        setError("Failed to load doctors. Please retry.");
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [hospitalId]);

  const handleIssue = async () => {
    if (!selectedDoctor && !selectedDept) {
      setError("Please select a doctor or department.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = `${patient.id}-${Date.now()}`;
      const token = await issueToken({
        patient_id: patient.id,
        doctor_id: selectedDoctor || null,
        department_id: selectedDept || null,
        hospital_id: hospitalId,
        type: tokenType,
        "X-Idempotency-Key": idempotencyKey,
      });
      setIssuedToken(token);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = (shouldPrint) => {
    if (shouldPrint) printToken(issuedToken);
    onSuccess(issuedToken);
  };

  // ── Token issued — show confirmation screen ──
  if (issuedToken) {
    return (
      <div style={s.overlay}>
        <div style={{ ...s.modal, maxWidth: 420, textAlign: "center", padding: 32 }}>
          <div style={s.successIcon}>✓</div>
          <h2 style={s.successTitle}>Token Issued!</h2>
          <div style={s.tokenBadge}>{issuedToken.token_number}</div>
          <div style={s.tokenInfo}>
            <Row label="Patient" value={issuedToken.patient_name} />
            <Row label="Doctor" value={issuedToken.doctor_name || "—"} />
            <Row label="Type" value={issuedToken.type.replace("_", " ")} />
            <Row label="Position" value={`#${issuedToken.queue_position} in queue`} />
          </div>
          <div style={s.actions}>
            <button style={s.cancelBtn} onClick={() => handleDone(false)}>Done</button>
            <button style={s.printBtn} onClick={() => handleDone(true)}>🖨 Print Token</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <h2 style={s.title}>Issue Queue Token</h2>
            <p style={s.subtitle}>Patient: <strong>{patient.name}</strong></p>
          </div>
          <button style={s.closeBtn} onClick={onCancel}>✕</button>
        </div>

        {error && <div style={s.errorBanner}>{error}</div>}

        {fetching ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading doctors…</div>
        ) : (
          <div style={s.body}>
            {/* Token Type */}
            <Section title="Token Type">
              <div style={s.typeGrid}>
                {[
                  { value: "walk_in", label: "Walk-In", color: "#2563eb", bg: "#eff6ff" },
                  { value: "appointment", label: "Appointment", color: "#059669", bg: "#ecfdf5" },
                ].map(({ value, label, color, bg }) => (
                  <button
                    key={value}
                    style={{
                      ...s.typeBtn,
                      border: `2px solid ${tokenType === value ? color : "#e5e7eb"}`,
                      background: tokenType === value ? bg : "#fff",
                      color: tokenType === value ? color : "#374151",
                    }}
                    onClick={() => setTokenType(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Doctor selection */}
            <Section title="Select Doctor (Available Now)">
              {doctors.length === 0 ? (
                <p style={{ color: "#6b7280", fontSize: 13 }}>No doctors available right now.</p>
              ) : (
                <div style={s.doctorGrid}>
                  {doctors.map((d) => (
                    <button
                      key={d.id}
                      style={{
                        ...s.doctorCard,
                        border: `2px solid ${selectedDoctor === d.id ? "#2563eb" : "#e5e7eb"}`,
                        background: selectedDoctor === d.id ? "#eff6ff" : "#fff",
                      }}
                      onClick={() => { setSelectedDoctor(d.id); setSelectedDept(""); }}
                    >
                      <div style={s.doctorAvatar}>{d.name.charAt(0)}</div>
                      <div style={s.doctorName}>Dr. {d.name}</div>
                      <div style={s.doctorSub}>{d.specialty || d.department}</div>
                      <div style={s.doctorQueue}>
                        <span style={s.queueDot} />
                        {d.queue_length ?? 0} waiting
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {/* OR Department */}
            <Section title="Or Select Department">
              <select
                style={s.select}
                value={selectedDept}
                onChange={(e) => { setSelectedDept(e.target.value); setSelectedDoctor(""); }}
              >
                <option value="">— Choose department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Section>

            <div style={s.actions}>
              <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
              <button
                style={{
                  ...s.issueBtn,
                  opacity: loading ? 0.7 : 1,
                }}
                onClick={handleIssue}
                disabled={loading}
              >
                {loading ? "Issuing…" : "Issue Token →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
      {title}
    </div>
    {children}
  </div>
);

const Row = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
    <span style={{ color: "#6b7280", fontSize: 13 }}>{label}</span>
    <span style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{value}</span>
  </div>
);

const s = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1001, padding: 16,
  },
  modal: {
    background: "#fff", borderRadius: 16,
    width: "100%", maxWidth: 580,
    maxHeight: "90vh", overflowY: "auto",
    boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
  },
  header: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    padding: "20px 24px", borderBottom: "1px solid #e5e7eb",
  },
  title: { fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  closeBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6b7280" },
  errorBanner: {
    margin: "12px 24px 0", padding: "10px 14px",
    background: "#fef2f2", color: "#dc2626",
    borderRadius: 8, fontSize: 13, border: "1px solid #fecaca",
  },
  body: { padding: "20px 24px" },
  typeGrid: { display: "flex", gap: 12 },
  typeBtn: {
    flex: 1, padding: "10px 16px", borderRadius: 8,
    cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.15s",
  },
  doctorGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12,
  },
  doctorCard: {
    padding: "14px 12px", borderRadius: 10, cursor: "pointer",
    textAlign: "center", transition: "all 0.15s",
  },
  doctorAvatar: {
    width: 40, height: 40, borderRadius: "50%",
    background: "#dbeafe", color: "#1d4ed8",
    fontSize: 18, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 8px",
  },
  doctorName: { fontSize: 13, fontWeight: 600, color: "#111827" },
  doctorSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  doctorQueue: { fontSize: 11, color: "#059669", marginTop: 4, display: "flex", alignItems: "center", gap: 4, justifyContent: "center" },
  queueDot: { width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" },
  select: {
    width: "100%", padding: "10px 12px",
    border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 14,
    background: "#fff", outline: "none",
  },
  actions: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 },
  cancelBtn: {
    padding: "10px 20px", border: "1.5px solid #d1d5db",
    borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14, color: "#374151",
  },
  issueBtn: {
    padding: "10px 24px", border: "none",
    borderRadius: 8, background: "#1d4ed8", color: "#fff",
    cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "opacity 0.15s",
  },
  printBtn: {
    padding: "10px 24px", border: "none",
    borderRadius: 8, background: "#1d4ed8", color: "#fff",
    cursor: "pointer", fontSize: 14, fontWeight: 600,
  },
  // Success state
  successIcon: {
    width: 56, height: 56, borderRadius: "50%",
    background: "#dcfce7", color: "#16a34a",
    fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 12px",
  },
  successTitle: { fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 },
  tokenBadge: {
    fontSize: 64, fontWeight: 900, color: "#1d4ed8",
    lineHeight: 1, margin: "12px 0",
  },
  tokenInfo: { textAlign: "left", margin: "16px 0" },
};

export default TokenAssignmentModal;
