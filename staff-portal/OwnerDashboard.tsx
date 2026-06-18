// src/pages/Dashboard/OwnerDashboard.tsx
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import useStore from "../../store/useStore";

interface OwnerStats {
  revenue_today: number;
  revenue_target: number;
  total_patients_today: number;
  doctors_on_duty: number;
  total_doctors: number;
  occupancy_rate: number;
  net_earnings_month: number;
  pending_invoices: number;
  revenue_chart: { date: string; revenue: number; target: number }[];
  top_departments: { name: string; patients: number; revenue: number }[];
}

const API = import.meta.env.VITE_API_BASE_URL || "";

async function fetchOwnerStats(token: string): Promise<OwnerStats> {
  const res = await fetch(`${API}/api/v1/owner/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch owner stats");
  return res.json();
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent || "#fff", letterSpacing: -1 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

export default function OwnerDashboard() {
  const token = useStore((s) => s.token);
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchOwnerStats(token)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const revenueProgress = stats
    ? Math.min(100, Math.round((stats.revenue_today / stats.revenue_target) * 100))
    : 0;

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
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
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
          Owner Dashboard
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", margin: "6px 0 0", fontSize: 14 }}>
          Real-time hospital performance overview
        </p>
      </div>

      {loading && (
        <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", paddingTop: 80 }}>
          Loading stats…
        </div>
      )}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171",
            padding: "14px 18px",
            borderRadius: 10,
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {stats && (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 16,
              marginBottom: 28,
            }}
          >
            <StatCard
              icon="💰"
              label="Revenue Today"
              value={`₹${stats.revenue_today.toLocaleString("en-IN")}`}
              sub={`Target: ₹${stats.revenue_target.toLocaleString("en-IN")}`}
              accent="#34d399"
            />
            <StatCard
              icon="🧑‍⚕️"
              label="Patients Today"
              value={String(stats.total_patients_today)}
              accent="#60a5fa"
            />
            <StatCard
              icon="👨‍⚕️"
              label="Doctors on Duty"
              value={`${stats.doctors_on_duty} / ${stats.total_doctors}`}
              accent="#a78bfa"
            />
            <StatCard
              icon="🏥"
              label="Bed Occupancy"
              value={`${stats.occupancy_rate}%`}
              accent={stats.occupancy_rate > 80 ? "#f87171" : "#34d399"}
            />
            <StatCard
              icon="📈"
              label="Net Earnings (Month)"
              value={`₹${stats.net_earnings_month.toLocaleString("en-IN")}`}
              accent="#fbbf24"
            />
            <StatCard
              icon="🧾"
              label="Pending Invoices"
              value={String(stats.pending_invoices)}
              accent={stats.pending_invoices > 10 ? "#f87171" : "#94a3b8"}
            />
          </div>

          {/* Revenue Progress Bar */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
                fontSize: 14,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <span>Revenue vs Target</span>
              <span style={{ color: revenueProgress >= 100 ? "#34d399" : "#fbbf24" }}>
                {revenueProgress}%
              </span>
            </div>
            <div
              style={{
                height: 10,
                background: "rgba(255,255,255,0.07)",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${revenueProgress}%`,
                  background:
                    revenueProgress >= 100
                      ? "linear-gradient(90deg,#34d399,#059669)"
                      : "linear-gradient(90deg,#0D9488,#6366F1)",
                  borderRadius: 99,
                  transition: "width 0.8s ease",
                }}
              />
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Revenue Area Chart */}
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "20px 16px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px 8px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Revenue Trend (7 days)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.revenue_chart}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#0d1526",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 13,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0D9488"
                    strokeWidth={2}
                    fill="url(#revGrad)"
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="target"
                    stroke="#6366F1"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="none"
                    name="Target"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Top Departments Bar Chart */}
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "20px 16px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px 8px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Top Departments
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.top_departments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#0d1526",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }} />
                  <Bar dataKey="patients" fill="#6366F1" radius={[4, 4, 0, 0]} name="Patients" />
                  <Bar dataKey="revenue" fill="#0D9488" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
