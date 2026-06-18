import { useEffect, useRef, useState } from "react";
import { useQueueWebSocket } from "../hooks/useQueueWebSocket";

/**
 * Vitals-alert WebSocket hook (separate channel from queue)
 * Connects to: ws://[API_BASE]/ws/vitals/{hospital_id}?token=JWT
 */
function useVitalsWebSocket(hospitalId) {
  const [alerts, setAlerts] = useState([]);
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const retryCount = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const connect = () => {
      const apiBase =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const wsBase = apiBase.replace(/^http/, "ws");
      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token") ||
        "";
      const url = `${wsBase}/ws/vitals/${hospitalId}?token=${token}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        if (!mounted.current) return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "vitals_alert") {
            setAlerts((prev) => [
              {
                id: Date.now(),
                ...msg,
                receivedAt: new Date().toLocaleTimeString(),
              },
              ...prev.slice(0, 49), // keep last 50
            ]);
          }
        } catch (_) {}
      };

      ws.onclose = (e) => {
        if (!mounted.current || e.code === 1000) return;
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
        retryCount.current++;
        retryRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      mounted.current = false;
      clearTimeout(retryRef.current);
      wsRef.current?.close(1000);
    };
  }, [hospitalId]);

  const dismissAlert = (id) =>
    setAlerts((prev) => prev.filter((a) => a.id !== id));

  return { alerts, dismissAlert };
}

// ─── VitalsAlertBanner ────────────────────────────────────────────────────────
function VitalsAlertBanner({ alert, onDismiss }) {
  const severityStyle =
    alert.severity === "critical"
      ? "bg-red-600 text-white"
      : alert.severity === "warning"
      ? "bg-orange-500 text-white"
      : "bg-yellow-100 text-yellow-800 border border-yellow-300";

  return (
    <div
      className={`flex items-start justify-between rounded-lg px-4 py-3 text-sm shadow ${severityStyle}`}
    >
      <div>
        <span className="font-bold mr-2">
          {alert.severity === "critical" ? "🚨 CRITICAL" : "⚠️ Alert"}
        </span>
        <span>
          {alert.patient_name} — {alert.message}
        </span>
        <span className="ml-2 opacity-70 text-xs">{alert.receivedAt}</span>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="ml-4 opacity-80 hover:opacity-100 font-bold text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

// ─── NurseDashboard ───────────────────────────────────────────────────────────
export default function NurseDashboard() {
  const hospitalId =
    localStorage.getItem("hospital_id") ||
    sessionStorage.getItem("hospital_id") ||
    "1";

  const { queueData, connectionStatus } = useQueueWebSocket(hospitalId);
  const { alerts, dismissAlert } = useVitalsWebSocket(hospitalId);

  const waitingPatients = queueData.filter((p) => p.status === "waiting");

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Nurse Dashboard
      </h1>

      {/* ── Vitals Alerts ── */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Vitals Alerts ({alerts.length})
          </h2>
          <div className="flex flex-col gap-2">
            {alerts.map((a) => (
              <VitalsAlertBanner key={a.id} alert={a} onDismiss={dismissAlert} />
            ))}
          </div>
        </div>
      )}

      {/* ── Queue status pill ── */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connectionStatus === "connected"
              ? "bg-green-500 animate-pulse"
              : "bg-red-500"
          }`}
        />
        <span className="text-sm text-gray-600">
          {connectionStatus === "connected"
            ? `Live · ${waitingPatients.length} waiting`
            : "Reconnecting…"}
        </span>
      </div>

      {/* ── Waiting patients table ── */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Token</th>
              <th className="px-4 py-3 text-left">Patient</th>
              <th className="px-4 py-3 text-left">Complaint</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {waitingPatients.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No patients currently waiting
                </td>
              </tr>
            )}
            {waitingPatients.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-bold text-gray-700">
                  {p.token || "—"}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {p.name}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {p.complaint || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium">
                    Waiting
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
