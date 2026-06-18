// src/pages/Settings.tsx
// ⚠ This file is MISSING from the current codebase — the sidebar links to it but it doesn't exist.
// Drop this file into: src/pages/Settings.tsx
// Then ensure App.tsx has: <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

import { useEffect, useState } from "react";
import useStore from "../store/useStore";

const API = import.meta.env.VITE_API_BASE_URL || "";

interface HospitalSettings {
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  registration_number: string;
  open_time: string;
  close_time: string;
  working_days: string[];
  emergency_available: boolean;
}

interface UserProfile {
  name: string;
  phone: string;
  email: string;
  role: string;
}

interface NotificationPrefs {
  sms_alerts: boolean;
  email_alerts: boolean;
  low_stock_alert: boolean;
  appointment_reminder: boolean;
}

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function patch(url: string, token: string, body: object) {
  const res = await fetch(`${API}${url}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Settings() {
  const token = useStore((s) => s.token);
  const hospitalId = useStore((s) => s.hospitalId);
  const [tab, setTab] = useState<"hospital" | "profile" | "notifications">("hospital");
  const [hospital, setHospital] = useState<HospitalSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      get<HospitalSettings>(`/api/v1/hospitals/${hospitalId}/settings`, token),
      get<UserProfile>("/api/v1/auth/me", token),
      get<NotificationPrefs>(`/api/v1/hospitals/${hospitalId}/notification-prefs`, token),
    ])
      .then(([h, p, n]) => {
        setHospital(h);
        setProfile(p);
        setNotifPrefs(n);
      })
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [token, hospitalId]);

  const saveHospital = async () => {
    if (!hospital || !token) return;
    setSaving(true);
    try {
      await patch(`/api/v1/hospitals/${hospitalId}/settings`, token, hospital);
      showToast("Hospital settings saved ✓", "success");
    } catch (e: unknown) {
      showToast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!profile || !token) return;
    setSaving(true);
    try {
      await patch("/api/v1/staff/me", token, profile);
      showToast("Profile updated ✓", "success");
    } catch (e: unknown) {
      showToast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveNotifs = async () => {
    if (!notifPrefs || !token) return;
    setSaving(true);
    try {
      await patch(`/api/v1/hospitals/${hospitalId}/notification-prefs`, token, notifPrefs);
      showToast("Notification preferences saved ✓", "success");
    } catch (e: unknown) {
      showToast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  };

  const labelStyle = {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    fontWeight: 600 as const,
    display: "block" as const,
    marginBottom: 6,
  };

  const sectionStyle = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "20px 24px",
    marginBottom: 16,
  };

  const ToggleRow = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        {description && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>{description}</div>}
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          background: checked ? "rgba(13,148,136,0.5)" : "rgba(255,255,255,0.1)",
          borderRadius: 99,
          cursor: "pointer",
          position: "relative",
          transition: "background 0.2s",
          border: checked ? "1px solid rgba(13,148,136,0.6)" : "1px solid rgba(255,255,255,0.15)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 22 : 3,
            width: 16,
            height: 16,
            background: checked ? "#0D9488" : "rgba(255,255,255,0.4)",
            borderRadius: "50%",
            transition: "left 0.2s",
          }}
        />
      </div>
    </div>
  );

  return (
    <div
      style={{
        padding: "28px 32px",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #060a14 0%, #0a1220 100%)",
        color: "#fff",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
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

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: "linear-gradient(90deg, #fff 60%, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Settings
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", margin: "6px 0 0", fontSize: 14 }}>
          Hospital, profile, and notification configuration
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {(["hospital", "profile", "notifications"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer",
              background: tab === t ? "rgba(255,255,255,0.08)" : "transparent",
              color: tab === t ? "#fff" : "rgba(255,255,255,0.4)",
              fontWeight: 600, fontSize: 14, textTransform: "capitalize", transition: "all 0.2s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", paddingTop: 60 }}>Loading…</div>}

      {/* Hospital Settings */}
      {!loading && tab === "hospital" && hospital && (
        <div>
          <div style={sectionStyle}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>
              Basic Info
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Hospital Name</label>
                <input value={hospital.name} onChange={(e) => setHospital({ ...hospital, name: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input value={hospital.phone} onChange={(e) => setHospital({ ...hospital, phone: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input value={hospital.email} onChange={(e) => setHospital({ ...hospital, email: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Registration Number</label>
                <input value={hospital.registration_number} onChange={(e) => setHospital({ ...hospital, registration_number: e.target.value })} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>
              Location
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Address</label>
                <input value={hospital.address} onChange={(e) => setHospital({ ...hospital, address: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input value={hospital.city} onChange={(e) => setHospital({ ...hospital, city: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input value={hospital.state} onChange={(e) => setHospital({ ...hospital, state: e.target.value })} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>
              Timings & Working Days
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Opening Time</label>
                <input type="time" value={hospital.open_time} onChange={(e) => setHospital({ ...hospital, open_time: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Closing Time</label>
                <input type="time" value={hospital.close_time} onChange={(e) => setHospital({ ...hospital, close_time: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <label style={labelStyle}>Working Days</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DAYS.map((d) => {
                const active = hospital.working_days.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() =>
                      setHospital({
                        ...hospital,
                        working_days: active
                          ? hospital.working_days.filter((x) => x !== d)
                          : [...hospital.working_days, d],
                      })
                    }
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: `1px solid ${active ? "rgba(13,148,136,0.5)" : "rgba(255,255,255,0.1)"}`,
                      background: active ? "rgba(13,148,136,0.15)" : "transparent",
                      color: active ? "#0D9488" : "rgba(255,255,255,0.4)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div
                onClick={() => setHospital({ ...hospital, emergency_available: !hospital.emergency_available })}
                style={{
                  width: 44, height: 24,
                  background: hospital.emergency_available ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)",
                  borderRadius: 99, cursor: "pointer", position: "relative", transition: "background 0.2s",
                  border: hospital.emergency_available ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <div style={{ position: "absolute", top: 3, left: hospital.emergency_available ? 22 : 3, width: 16, height: 16, background: hospital.emergency_available ? "#f87171" : "rgba(255,255,255,0.4)", borderRadius: "50%", transition: "left 0.2s" }} />
              </div>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Emergency services available 24/7</span>
            </div>
          </div>

          <button
            onClick={saveHospital}
            disabled={saving}
            style={{ background: saving ? "rgba(255,255,255,0.06)" : "rgba(13,148,136,0.2)", border: "1px solid rgba(13,148,136,0.5)", color: saving ? "rgba(255,255,255,0.3)" : "#0D9488", padding: "12px 28px", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15 }}
          >
            {saving ? "Saving…" : "Save Hospital Settings"}
          </button>
        </div>
      )}

      {/* Profile */}
      {!loading && tab === "profile" && profile && (
        <div>
          <div style={sectionStyle}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>
              Your Profile
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <input value={profile.role} disabled style={{ ...inputStyle, opacity: 0.4, cursor: "not-allowed" }} />
              </div>
            </div>
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            style={{ background: saving ? "rgba(255,255,255,0.06)" : "rgba(13,148,136,0.2)", border: "1px solid rgba(13,148,136,0.5)", color: saving ? "rgba(255,255,255,0.3)" : "#0D9488", padding: "12px 28px", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15 }}
          >
            {saving ? "Saving…" : "Update Profile"}
          </button>
        </div>
      )}

      {/* Notifications */}
      {!loading && tab === "notifications" && notifPrefs && (
        <div>
          <div style={sectionStyle}>
            <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>
              Notification Preferences
            </h3>
            <ToggleRow label="SMS Alerts" description="Receive alerts via SMS" checked={notifPrefs.sms_alerts} onChange={(v) => setNotifPrefs({ ...notifPrefs, sms_alerts: v })} />
            <ToggleRow label="Email Alerts" description="Receive alerts via email" checked={notifPrefs.email_alerts} onChange={(v) => setNotifPrefs({ ...notifPrefs, email_alerts: v })} />
            <ToggleRow label="Low Stock Alerts" description="Alert when medicine stock is below reorder level" checked={notifPrefs.low_stock_alert} onChange={(v) => setNotifPrefs({ ...notifPrefs, low_stock_alert: v })} />
            <ToggleRow label="Appointment Reminders" description="Send reminders to patients before appointments" checked={notifPrefs.appointment_reminder} onChange={(v) => setNotifPrefs({ ...notifPrefs, appointment_reminder: v })} />
          </div>
          <button
            onClick={saveNotifs}
            disabled={saving}
            style={{ background: saving ? "rgba(255,255,255,0.06)" : "rgba(13,148,136,0.2)", border: "1px solid rgba(13,148,136,0.5)", color: saving ? "rgba(255,255,255,0.3)" : "#0D9488", padding: "12px 28px", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15 }}
          >
            {saving ? "Saving…" : "Save Preferences"}
          </button>
        </div>
      )}
    </div>
  );
}
