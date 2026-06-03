/**
 * CheckInPage
 * Core reception flow:
 *   1. Search patient
 *   2. Select or register patient
 *   3. Issue token (walk-in / appointment)
 *   4. Emergency override available at any time
 *
 * This page is the heart of the Reception module.
 */
import { useState } from "react";
import PatientSearchBar from "../components/reception/PatientSearchBar";
import WalkInRegistrationForm from "../components/reception/WalkInRegistrationForm";
import TokenAssignmentModal from "../components/reception/TokenAssignmentModal";
import EmergencyTokenButton from "../components/reception/EmergencyTokenButton";
import { useAuth } from "../hooks/useAuth";

const STEP = {
  SEARCH: "search",
  REGISTER: "register",
  ISSUE_TOKEN: "issue_token",
  DONE: "done",
};

const CheckInPage = () => {
  const { user } = useAuth();
  const hospitalId = user?.hospital_id;

  const [step, setStep] = useState(STEP.SEARCH);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [lastToken, setLastToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const reset = () => {
    setStep(STEP.SEARCH);
    setSelectedPatient(null);
    setLastToken(null);
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setStep(STEP.ISSUE_TOKEN);
  };

  const handleRegisterNew = () => setStep(STEP.REGISTER);

  const handleRegistered = (patient) => {
    setSelectedPatient(patient);
    setStep(STEP.ISSUE_TOKEN);
  };

  const handleTokenIssued = (token) => {
    setLastToken(token);
    setStep(STEP.DONE);
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.topBar}>
        <div>
          <h1 style={s.pageTitle}>Patient Check-In</h1>
          <p style={s.pageSubtitle}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <EmergencyTokenButton
          patient={selectedPatient}
          hospitalId={hospitalId}
          onSuccess={(tok) => {
            setLastToken(tok);
            setStep(STEP.DONE);
          }}
        />
      </div>

      {/* Progress trail */}
      <div style={s.stepper}>
        {[
          { key: STEP.SEARCH, label: "1. Find Patient" },
          { key: STEP.ISSUE_TOKEN, label: "2. Issue Token" },
          { key: STEP.DONE, label: "3. Done" },
        ].map(({ key, label }) => {
          const isActive = step === key || (step === STEP.REGISTER && key === STEP.SEARCH);
          const isDone =
            (key === STEP.SEARCH && (step === STEP.ISSUE_TOKEN || step === STEP.DONE)) ||
            (key === STEP.ISSUE_TOKEN && step === STEP.DONE);
          return (
            <div key={key} style={s.stepItem}>
              <div
                style={{
                  ...s.stepDot,
                  background: isDone ? "#059669" : isActive ? "#2563eb" : "#e5e7eb",
                  color: isDone || isActive ? "#fff" : "#9ca3af",
                }}
              >
                {isDone ? "✓" : label.charAt(0)}
              </div>
              <span
                style={{
                  ...s.stepLabel,
                  color: isActive ? "#2563eb" : isDone ? "#059669" : "#9ca3af",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main content area */}
      <div style={s.content}>
        {/* ── STEP 1: SEARCH ── */}
        {(step === STEP.SEARCH || step === STEP.REGISTER) && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>Search Existing Patient</h2>
            <p style={s.cardHint}>Enter patient name or 10-digit phone number</p>
            <PatientSearchBar
              onSelect={handlePatientSelect}
              onRegisterNew={handleRegisterNew}
              onQueryChange={setSearchQuery}
            />

            {step === STEP.SEARCH && (
              <div style={s.orRow}>
                <div style={s.orLine} />
                <span style={s.orText}>OR</span>
                <div style={s.orLine} />
              </div>
            )}

            {step === STEP.SEARCH && (
              <button style={s.newPatientBtn} onClick={handleRegisterNew}>
                + Register New Patient
              </button>
            )}
          </div>
        )}

        {/* ── STEP: PATIENT SELECTED (before modal) ── */}
        {step === STEP.ISSUE_TOKEN && selectedPatient && (
          <div style={s.card}>
            <div style={s.patientConfirm}>
              <div style={s.patientAvatar}>{selectedPatient.name.charAt(0)}</div>
              <div>
                <div style={s.patientName}>{selectedPatient.name}</div>
                <div style={s.patientMeta}>
                  📞 {selectedPatient.phone}
                  {selectedPatient.age && ` · ${selectedPatient.age}y`}
                  {selectedPatient.gender && ` · ${selectedPatient.gender}`}
                </div>
              </div>
              <button style={s.changeBtn} onClick={reset}>Change</button>
            </div>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === STEP.DONE && lastToken && (
          <div style={{ ...s.card, textAlign: "center" }}>
            <div style={s.doneIcon}>✓</div>
            <h2 style={s.doneTitle}>Check-In Complete!</h2>
            <div style={s.doneToken}>{lastToken.token_number}</div>
            <div style={s.doneMeta}>
              <MetaRow label="Patient" value={lastToken.patient_name} />
              <MetaRow label="Doctor" value={lastToken.doctor_name || "—"} />
              <MetaRow label="Position" value={`#${lastToken.queue_position} in queue`} />
              <MetaRow label="Type" value={lastToken.type.replace("_", " ")} />
            </div>
            <div style={s.doneActions}>
              <button style={s.resetBtn} onClick={reset}>
                ← Next Patient
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS (rendered at top level to avoid z-index issues) ── */}
      {step === STEP.REGISTER && (
        <WalkInRegistrationForm
          onSuccess={handleRegistered}
          onCancel={() => setStep(STEP.SEARCH)}
          prefillPhone={searchQuery}
        />
      )}

      {step === STEP.ISSUE_TOKEN && selectedPatient && (
        <TokenAssignmentModal
          patient={selectedPatient}
          hospitalId={hospitalId}
          onSuccess={handleTokenIssued}
          onCancel={() => setStep(STEP.SEARCH)}
        />
      )}
    </div>
  );
};

const MetaRow = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
    <span style={{ color: "#6b7280", fontSize: 13 }}>{label}</span>
    <span style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{value}</span>
  </div>
);

const s = {
  page: { maxWidth: 680, margin: "0 auto", padding: "24px 16px" },
  topBar: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    marginBottom: 24, gap: 12,
  },
  pageTitle: { fontSize: 24, fontWeight: 800, color: "#111827", margin: 0 },
  pageSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  stepper: {
    display: "flex", gap: 20, alignItems: "center", marginBottom: 24,
    background: "#f9fafb", borderRadius: 10, padding: "12px 16px",
  },
  stepItem: { display: "flex", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: "50%",
    fontSize: 11, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  stepLabel: { fontSize: 13 },
  content: {},
  card: {
    background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: 12, padding: 24, marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 },
  cardHint: { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  orRow: {
    display: "flex", alignItems: "center", gap: 12, margin: "20px 0",
  },
  orLine: { flex: 1, height: 1, background: "#e5e7eb" },
  orText: { fontSize: 12, color: "#9ca3af", fontWeight: 600 },
  newPatientBtn: {
    width: "100%", padding: "12px",
    border: "1.5px dashed #d1d5db", borderRadius: 10,
    background: "#fafafa", color: "#374151",
    cursor: "pointer", fontSize: 14, fontWeight: 600,
    transition: "all 0.15s",
  },
  patientConfirm: {
    display: "flex", alignItems: "center", gap: 14,
  },
  patientAvatar: {
    width: 48, height: 48, borderRadius: "50%",
    background: "#dbeafe", color: "#1d4ed8",
    fontSize: 20, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  patientName: { fontSize: 16, fontWeight: 700, color: "#111827" },
  patientMeta: { fontSize: 13, color: "#6b7280", marginTop: 3 },
  changeBtn: {
    marginLeft: "auto", background: "none",
    border: "1.5px solid #d1d5db", borderRadius: 6,
    padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#374151",
  },
  doneIcon: {
    width: 60, height: 60, borderRadius: "50%",
    background: "#dcfce7", color: "#16a34a",
    fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 12px",
  },
  doneTitle: { fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 },
  doneToken: {
    fontSize: 72, fontWeight: 900, color: "#1d4ed8",
    lineHeight: 1, marginBottom: 16,
  },
  doneMeta: { textAlign: "left", margin: "0 auto 20px", maxWidth: 300 },
  doneActions: { display: "flex", justifyContent: "center" },
  resetBtn: {
    padding: "12px 28px", background: "#1d4ed8", color: "#fff",
    border: "none", borderRadius: 8, cursor: "pointer",
    fontSize: 14, fontWeight: 600,
  },
};

export default CheckInPage;
