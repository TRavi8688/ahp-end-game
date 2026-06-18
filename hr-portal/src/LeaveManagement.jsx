import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../services/apiClient";
import useAuthStore from "../store/authStore";

const LEAVE_LIMITS = { sick: 12, casual: 6, earned: 15 };
const TAB_STYLES = {
  pending:  "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

// ─── Mini CSS-grid weekly calendar ────────────────────────────────────────────
function WeekCalendar({ leaves }) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const approvedThisWeek = (leaves || []).filter((l) => {
    if (l.status !== "approved") return false;
    const start = new Date(l.start_date);
    const end = new Date(l.end_date);
    return days.some((d) => d >= start && d <= end);
  });

  const onLeaveOnDay = (day) =>
    approvedThisWeek.filter((l) => {
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      return day >= start && day <= end;
    });

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="rounded-xl bg-white shadow-sm p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Staff on Leave This Week</h3>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const onLeave = onLeaveOnDay(day);
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div key={i} className={`rounded-lg p-2 text-center min-h-[64px] ${isToday ? "bg-blue-50 ring-2 ring-blue-400" : "bg-gray-50"}`}>
              <p className="text-xs font-medium text-gray-500">{DAY_LABELS[i]}</p>
              <p className={`text-sm font-bold ${isToday ? "text-blue-700" : "text-gray-700"}`}>
                {day.getDate()}
              </p>
              {onLeave.map((l, j) => (
                <p key={j} className="text-xs mt-0.5 bg-orange-100 text-orange-700 rounded px-1 truncate">
                  {l.staff_name?.split(" ")[0]}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Reject modal ─────────────────────────────────────────────────────────────
function RejectModal({ leaveId, onClose, onReject }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Reject Leave Request</h3>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Reason for rejection…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!reason.trim() || loading}
            onClick={async () => {
              setLoading(true);
              await onReject(leaveId, reason);
              onClose();
            }}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LeaveManagement ──────────────────────────────────────────────────────────
export default function LeaveManagement() {
  const hospitalId = useAuthStore((s) => s.hospitalId) || "1";
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["leaves", hospitalId],
    queryFn: () =>
      apiClient
        .get(`/api/v1/staff/leaves?hospital_id=${hospitalId}`)
        .then((r) => r.data?.leaves || r.data || []),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/api/v1/staff/leaves/${id}/approve`),
    onSuccess: () => qc.invalidateQueries(["leaves", hospitalId]),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      apiClient.patch(`/api/v1/staff/leaves/${id}/reject`, { reason }),
    onSuccess: () => qc.invalidateQueries(["leaves", hospitalId]),
  });

  const filtered = leaves.filter((l) => l.status === tab);

  // Leave balance summary per staff
  const balanceMap = {};
  leaves.forEach((l) => {
    if (l.status !== "approved") return;
    if (!balanceMap[l.staff_id]) {
      balanceMap[l.staff_id] = { name: l.staff_name, sick: 0, casual: 0, earned: 0 };
    }
    const days = Math.ceil(
      (new Date(l.end_date) - new Date(l.start_date)) / 86400000
    ) + 1;
    balanceMap[l.staff_id][l.leave_type] =
      (balanceMap[l.staff_id][l.leave_type] || 0) + days;
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Leave Management</h1>

      <WeekCalendar leaves={leaves} />

      {/* Leave balance table */}
      {Object.keys(balanceMap).length > 0 && (
        <div className="rounded-xl bg-white shadow-sm overflow-x-auto mb-6">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Leave Balance (used / allowed)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Staff</th>
                <th className="px-4 py-2 text-center">Sick (12)</th>
                <th className="px-4 py-2 text-center">Casual (6)</th>
                <th className="px-4 py-2 text-center">Earned (15)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.values(balanceMap).map((b) => (
                <tr key={b.name}>
                  <td className="px-4 py-2 font-medium text-gray-800">{b.name}</td>
                  {["sick", "casual", "earned"].map((type) => {
                    const used = b[type] || 0;
                    const max = LEAVE_LIMITS[type];
                    const overLimit = used > max;
                    return (
                      <td key={type} className="px-4 py-2 text-center">
                        <span className={overLimit ? "text-red-600 font-bold" : "text-gray-700"}>
                          {used}/{max}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {["pending", "approved", "rejected"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? TAB_STYLES[t] : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t}{" "}
            <span className="ml-1 opacity-60">
              ({leaves.filter((l) => l.status === t).length})
            </span>
          </button>
        ))}
      </div>

      {/* Leave cards */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-xl bg-white shadow-sm p-10 text-center text-gray-400">
              No {tab} leave requests
            </div>
          )}
          {filtered.map((l) => (
            <div key={l.id} className="rounded-xl bg-white shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{l.staff_name}</p>
                <p className="text-sm text-gray-500 capitalize">{l.leave_type?.replace("_", " ")} leave · {l.days || "?"} day(s)</p>
                <p className="text-sm text-gray-500">
                  {l.start_date && new Date(l.start_date).toLocaleDateString("en-IN")} →{" "}
                  {l.end_date && new Date(l.end_date).toLocaleDateString("en-IN")}
                </p>
                {l.reason && <p className="text-xs text-gray-400 mt-1">"{l.reason}"</p>}
                {l.rejection_reason && (
                  <p className="text-xs text-red-500 mt-1">Rejected: {l.rejection_reason}</p>
                )}
              </div>
              {tab === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate(l.id)}
                    className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => setRejectTarget(l.id)}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                  >
                    ✗ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          leaveId={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={(id, reason) => rejectMutation.mutateAsync({ id, reason })}
        />
      )}
    </div>
  );
}
