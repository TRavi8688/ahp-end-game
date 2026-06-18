import { useEffect, useState, useRef } from "react";
import { useQueueWebSocket } from "../hooks/useQueueWebSocket";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  waiting: {
    label: "Waiting",
    bg: "bg-green-50",
    border: "border-green-400",
    badge: "bg-green-100 text-green-800",
    dot: "bg-green-500",
  },
  with_doctor: {
    label: "With Doctor",
    bg: "bg-blue-50",
    border: "border-blue-400",
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
  },
  pending_lab: {
    label: "Pending Lab",
    bg: "bg-orange-50",
    border: "border-orange-400",
    badge: "bg-orange-100 text-orange-800",
    dot: "bg-orange-500",
  },
  emergency: {
    label: "Emergency",
    bg: "bg-red-50",
    border: "border-red-500",
    badge: "bg-red-100 text-red-800",
    dot: "bg-red-500",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getElapsed(arrivedAt) {
  if (!arrivedAt) return "—";
  const diff = Math.floor((Date.now() - new Date(arrivedAt).getTime()) / 60000);
  if (diff < 1) return "Just now";
  if (diff === 1) return "1 min ago";
  if (diff < 60) return `${diff} mins ago`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h ${m}m ago`;
}

// ─── PatientCard ──────────────────────────────────────────────────────────────
function PatientCard({ patient, isNew, tick }) {
  const animRef = useRef(null);
  const cfg = STATUS_CONFIG[patient.status] || STATUS_CONFIG.waiting;

  // Remove the _isNew flag after animation plays
  useEffect(() => {
    if (isNew && animRef.current) {
      animRef.current.classList.add("animate-slide-in");
      const t = setTimeout(() => {
        animRef.current?.classList.remove("animate-slide-in");
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  return (
    <div
      ref={animRef}
      className={`
        queue-card flex items-center gap-4 rounded-xl border-l-4 p-4 shadow-sm transition-all
        ${cfg.bg} ${cfg.border}
      `}
    >
      {/* Token */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white shadow text-lg font-bold text-gray-700">
        {patient.token || "—"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">
          {patient.name || "Unknown Patient"}
        </p>
        <p className="text-sm text-gray-500 truncate">
          {patient.complaint || patient.department || ""}
        </p>
      </div>

      {/* Doctor */}
      {patient.doctor_name && (
        <div className="hidden sm:block text-sm text-gray-600 truncate max-w-[120px]">
          Dr. {patient.doctor_name}
        </div>
      )}

      {/* Elapsed time — updates every minute via tick */}
      <div className="hidden md:block text-xs text-gray-400 whitespace-nowrap">
        {getElapsed(patient.arrived_at)}
      </div>

      {/* Status badge */}
      <span
        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${cfg.badge}`}
      >
        {cfg.label}
      </span>
    </div>
  );
}

// ─── ConnectionIndicator ──────────────────────────────────────────────────────
function ConnectionIndicator({ status }) {
  const map = {
    connected: {
      dot: "bg-green-500",
      pulse: "animate-pulse",
      text: "Live",
      textColor: "text-green-700",
    },
    reconnecting: {
      dot: "bg-red-500",
      pulse: "animate-bounce",
      text: "Reconnecting…",
      textColor: "text-red-600",
    },
    disconnected: {
      dot: "bg-gray-400",
      pulse: "",
      text: "Disconnected",
      textColor: "text-gray-500",
    },
  };
  const cfg = map[status] || map.disconnected;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${cfg.dot} ${cfg.pulse}`}
      />
      <span className={`text-sm font-medium ${cfg.textColor}`}>{cfg.text}</span>
    </div>
  );
}

// ─── QueueBoard (main export) ─────────────────────────────────────────────────
export default function QueueBoard() {
  // hospitalId from auth store / context — adjust import to match your project
  const hospitalId =
    localStorage.getItem("hospital_id") ||
    sessionStorage.getItem("hospital_id") ||
    "1";

  const { queueData, connectionStatus } = useQueueWebSocket(hospitalId);

  // tick every 60s to refresh elapsed times without re-fetching
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Filter state
  const [filter, setFilter] = useState("all");
  const filters = [
    { key: "all", label: "All" },
    { key: "emergency", label: "Emergency" },
    { key: "waiting", label: "Waiting" },
    { key: "with_doctor", label: "With Doctor" },
    { key: "pending_lab", label: "Pending Lab" },
  ];

  const displayed =
    filter === "all" ? queueData : queueData.filter((p) => p.status === filter);

  // Counts
  const counts = queueData.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Queue Board</h1>
          <p className="text-sm text-gray-500">
            {queueData.length} patient{queueData.length !== 1 ? "s" : ""} in
            queue
          </p>
        </div>
        <ConnectionIndicator status={connectionStatus} />
      </div>

      {/* ── Summary cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: "waiting", label: "Waiting", color: "text-green-600" },
          { key: "with_doctor", label: "With Doctor", color: "text-blue-600" },
          { key: "pending_lab", label: "Pending Lab", color: "text-orange-600" },
          { key: "emergency", label: "Emergency", color: "text-red-600" },
        ].map(({ key, label, color }) => (
          <div
            key={key}
            className="rounded-xl bg-white p-4 shadow-sm text-center"
          >
            <p className={`text-3xl font-bold ${color}`}>{counts[key] || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === key
                ? "bg-blue-600 text-white shadow"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {label}
            {key !== "all" && counts[key] ? (
              <span className="ml-1.5 opacity-75">({counts[key]})</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Queue list ── */}
      <div className="flex flex-col gap-3">
        {displayed.length === 0 && (
          <div className="rounded-xl bg-white p-12 text-center text-gray-400 shadow-sm">
            <p className="text-4xl mb-3">🏥</p>
            <p className="font-medium">
              {filter === "all"
                ? "Queue is empty"
                : `No patients with status "${filter}"`}
            </p>
          </div>
        )}
        {displayed.map((patient) => (
          <PatientCard
            key={patient.id}
            patient={patient}
            isNew={patient._isNew}
            tick={tick}
          />
        ))}
      </div>

      {/* ── Slide-in animation styles ── */}
      <style>{`
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translateY(-24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
          animation: slideInFromTop 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
