import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      // Role-based redirect
      if (user.role === "receptionist") navigate("/reception/checkin");
      else if (user.role === "nurse") navigate("/nurse/dashboard");
      else navigate("/dashboard");
    } catch {
      // error shown via hook
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={s.logoText}>Hospyn</span>
          <span style={s.logoBadge}>Staff Portal</span>
        </div>

        <h1 style={s.title}>Sign in to continue</h1>
        <p style={s.subtitle}>Reception & Nursing Dashboard</p>

        {error && <div style={s.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Staff Email</label>
            <input
              style={s.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@hospital.com"
              required
              autoComplete="username"
            />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Password</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" style={s.submitBtn} disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <p style={s.footer}>
          Forgot credentials? Contact your hospital administrator.
        </p>
      </div>
    </div>
  );
};

const s = {
  page: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f8faff", padding: 16,
  },
  card: {
    background: "#fff", borderRadius: 16, padding: "36px 32px",
    width: "100%", maxWidth: 400,
    boxShadow: "0 4px 32px rgba(29,78,216,0.08)",
    border: "1px solid #e0e7ff",
  },
  logo: { display: "flex", alignItems: "center", gap: 8, marginBottom: 24 },
  logoText: { fontSize: 22, fontWeight: 800, color: "#1d4ed8" },
  logoBadge: {
    fontSize: 10, fontWeight: 700, color: "#2563eb",
    background: "#eff6ff", padding: "2px 8px",
    borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.08em",
  },
  title: { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 24 },
  errorBanner: {
    padding: "10px 14px", background: "#fef2f2", color: "#dc2626",
    borderRadius: 8, fontSize: 13, marginBottom: 16, border: "1px solid #fecaca",
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: {
    padding: "11px 14px", border: "1.5px solid #d1d5db",
    borderRadius: 8, fontSize: 15, outline: "none",
  },
  submitBtn: {
    padding: "13px", border: "none",
    borderRadius: 8, background: "#1d4ed8", color: "#fff",
    cursor: "pointer", fontSize: 15, fontWeight: 700,
    marginTop: 4, transition: "opacity 0.15s",
  },
  footer: { fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 24 },
};

export default LoginPage;
