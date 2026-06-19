import { useState } from "react";
import { issueToken } from "../../services/receptionApi";
import { printToken } from "../../utils/printToken";

/**
 * EmergencyTokenButton
 * Props:
 *   patient    — patient object (must be selected first)
 *   hospitalId
 *   onSuccess(token)
 */
const EmergencyTokenButton = ({ patient, hospitalId, onSuccess }) => {
  const [step, setStep] = useState("idle"); // idle | confirm | loading | done
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  const handleClick = () => {
    if (!patient) return;
    setStep("confirm");
  };

  const handleConfirm = async () => {
    setStep("loading");
    setError(null);
    try {
      const tok = await issueToken({
        patient_id: patient.id,
        hospital_id: hospitalId,
        type: "emergency",
        priority_override: true,
      });
      setToken(tok);
      setStep("done");
      onSuccess?.(tok);
    } catch (e) {
      setError(e.message);
      setStep("confirm");
    }
  };

  const handleClose = () => {
    setStep("idle");
    setToken(null);
    setError(null);
  };

  return (
    <>
      <button
        style={{
          ...s.btn,
          opacity: !patient ? 0.5 : 1,
          cursor: !patient ? "not-allowed" : "pointer",
        }}
        onClick={handleClick}
        disabled={!patient}
        title={!patient ? "Select a patient first" : "Issue emergency token"}
      >
        🚨 Emergency
      </button>

      {step === "confirm" && (
        <div style={s.overlay}>
          <div style={s.dialog}>
            <div style={s.warningIcon}>⚠️</div>
            <h2 style={s.dialogTitle}>Emergency Priority Override</h2>
            <p style={s.dialogText}>
              This will issue an <strong>EMERGENCY</strong> token for{" "}
              <strong>{patient?.name}</strong> and move them to the front of the queue.
              Only use in genuine medical emergencies.
            </p>
            {error && <div style={s.errorBanner}>{error}</div>}
            <div style={s.dialogActions}>
              <button style={s.cancelBtn} onClick={handleClose}>Cancel</button>
              <button style={s.confirmBtn} onClick={handleConfirm}>
                Confirm Emergency
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "loading" && (
        <div style={s.overlay}>
          <div style={{ ...s.dialog, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <p>Issuing emergency token…</p>
          </div>
        </div>
      )}

      {step === "done" && token && (
        <div style={s.overlay}>
          <div style={{ ...s.dialog, textAlign: "center" }}>
            <div style={s.doneIcon}>🚨</div>
            <h2 style={s.dialogTitle}>Emergency Token Issued</h2>
            <div style={s.emergencyNum}>{token.token_number}</div>
            <p style={s.dialogText}>{patient?.name} has been moved to the front of the queue.</p>
            <div style={s.dialogActions}>
              <button style={s.cancelBtn} onClick={handleClose}>Done</button>
              <button style={s.printBtn} onClick={() => { printToken(token); handleClose(); }}>
                🖨 Print Token
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const s = {
  btn: {
    padding: "10px 18px",
    background: "#dc2626", color: "#fff",
    border: "none", borderRadius: 8,
    fontWeight: 700, fontSize: 14,
    display: "flex", alignItems: "center", gap: 6,
    transition: "opacity 0.15s",
  },
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1100, padding: 16,
  },
  dialog: {
    background: "#fff", borderRadius: 16,
    padding: "32px 28px", maxWidth: 420, width: "100%",
    boxShadow: "0 24px 64px rgba(220,38,38,0.2)",
    border: "2px solid #fca5a5",
  },
  warningIcon: { fontSize: 40, marginBottom: 12 },
  doneIcon: { fontSize: 48, marginBottom: 12 },
  dialogTitle: { fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 },
  dialogText: { fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 16 },
  errorBanner: {
    padding: "10px 14px", marginBottom: 12,
    background: "#fef2f2", color: "#dc2626",
    borderRadius: 8, fontSize: 13, border: "1px solid #fecaca",
  },
  emergencyNum: {
    fontSize: 80, fontWeight: 900, color: "#dc2626",
    lineHeight: 1, marginBottom: 12,
  },
  dialogActions: { display: "flex", gap: 12, justifyContent: "flex-end" },
  cancelBtn: {
    padding: "10px 20px", border: "1.5px solid #d1d5db",
    borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14,
  },
  confirmBtn: {
    padding: "10px 20px", border: "none",
    borderRadius: 8, background: "#dc2626", color: "#fff",
    cursor: "pointer", fontSize: 14, fontWeight: 700,
  },
  printBtn: {
    padding: "10px 20px", border: "none",
    borderRadius: 8, background: "#1d4ed8", color: "#fff",
    cursor: "pointer", fontSize: 14, fontWeight: 600,
  },
};

export default EmergencyTokenButton;
