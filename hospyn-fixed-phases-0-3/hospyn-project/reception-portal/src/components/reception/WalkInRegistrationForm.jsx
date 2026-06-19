import { useState } from "react";
import { registerPatient } from "../../services/receptionApi";

/**
 * WalkInRegistrationForm
 * Props:
 *   onSuccess(patient) — called with the newly registered patient
 *   onCancel()
 *   prefillPhone — optional phone from search query
 */
const WalkInRegistrationForm = ({ onSuccess, onCancel, prefillPhone = "" }) => {
  const [form, setForm] = useState({
    name: "",
    phone: prefillPhone,
    age: "",
    gender: "",
    blood_group: "",
    address: "",
    emergency_contact: "",
    allergies: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const patient = await registerPatient(form);
      onSuccess(patient);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <h2 style={s.title}>Register New Patient</h2>
          <button style={s.closeBtn} onClick={onCancel}>✕</button>
        </div>

        {error && <div style={s.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.row}>
            <Field label="Full Name *" type="text" value={form.name} onChange={set("name")} placeholder="e.g. Ravi Kumar" />
            <Field label="Phone *" type="tel" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile" />
          </div>
          <div style={s.row}>
            <Field label="Age" type="number" value={form.age} onChange={set("age")} placeholder="Years" min={0} max={150} />
            <div style={s.fieldWrap}>
              <label style={s.label}>Gender</label>
              <select style={s.select} value={form.gender} onChange={set("gender")}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Blood Group</label>
              <select style={s.select} value={form.blood_group} onChange={set("blood_group")}>
                <option value="">Unknown</option>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=>(
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
          <Field label="Address" type="text" value={form.address} onChange={set("address")} placeholder="Full address (optional)" />
          <div style={s.row}>
            <Field label="Emergency Contact" type="tel" value={form.emergency_contact} onChange={set("emergency_contact")} placeholder="Guardian/family number" />
            <Field label="Known Allergies" type="text" value={form.allergies} onChange={set("allergies")} placeholder="e.g. Penicillin, Peanuts" />
          </div>

          <div style={s.actions}>
            <button type="button" style={s.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
            <button type="submit" style={s.submitBtn} disabled={loading}>
              {loading ? "Registering…" : "Register & Continue →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Field = ({ label, ...props }) => (
  <div style={s.fieldWrap}>
    <label style={s.label}>{label}</label>
    <input style={s.input} {...props} />
  </div>
);

const s = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: "#fff", borderRadius: 16,
    width: "100%", maxWidth: 640,
    maxHeight: "90vh", overflowY: "auto",
    boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "20px 24px", borderBottom: "1px solid #e5e7eb",
  },
  title: { fontSize: 18, fontWeight: 700, color: "#111827" },
  closeBtn: {
    background: "none", border: "none", fontSize: 18,
    cursor: "pointer", color: "#6b7280", lineHeight: 1,
  },
  errorBanner: {
    margin: "0 24px 16px", padding: "10px 14px",
    background: "#fef2f2", color: "#dc2626",
    borderRadius: 8, fontSize: 13, border: "1px solid #fecaca",
  },
  form: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: {
    padding: "10px 12px", border: "1.5px solid #d1d5db",
    borderRadius: 8, fontSize: 14, outline: "none",
    transition: "border-color 0.15s",
  },
  select: {
    padding: "10px 12px", border: "1.5px solid #d1d5db",
    borderRadius: 8, fontSize: 14, outline: "none", background: "#fff",
  },
  actions: {
    display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8,
  },
  cancelBtn: {
    padding: "10px 20px", border: "1.5px solid #d1d5db",
    borderRadius: 8, background: "#fff", cursor: "pointer",
    fontSize: 14, color: "#374151",
  },
  submitBtn: {
    padding: "10px 24px", border: "none",
    borderRadius: 8, background: "#1d4ed8", color: "#fff",
    cursor: "pointer", fontSize: 14, fontWeight: 600,
  },
};

export default WalkInRegistrationForm;
