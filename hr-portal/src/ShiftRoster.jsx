import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../services/apiClient";
import useAuthStore from "../store/authStore";

const SHIFTS = ["morning", "afternoon", "night"];
const SHIFT_LABELS = { morning: "🌅 Morning", afternoon: "☀️ Afternoon", night: "🌙 Night" };
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

// ─── AssignModal ──────────────────────────────────────────────────────────────
function AssignModal({ date, shiftType, existingIds, staffList, onAssign, onClose }) {
  const [staffId, setStaffId] = useState("");
  const available = staffList.filter((s) => !existingIds.includes(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Assign Staff</h3>
        <p className="text-sm text-gray-500 mb-4 capitalize">
          {SHIFT_LABELS[shiftType]} · {new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
        </p>
        <select
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
        >
          <option value="">Select staff member…</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.role?.replace("_", " ")})
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!staffId}
            onClick={() => { onAssign(staffId); onClose(); }}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ShiftRoster ──────────────────────────────────────────────────────────────
export default function ShiftRoster() {
  const hospitalId = useAuthStore((s) => s.hospitalId) || "1";
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(getMondayOfWeek());
  const [assignCell, setAssignCell] = useState(null); // { date, shiftType }

  const weekDates = getWeekDates(weekStart);

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", hospitalId],
    queryFn: () =>
      apiClient
        .get(`/api/v1/staff/hospital/${hospitalId}`)
        .then((r) => (r.data?.staff || r.data || []).filter((s) => s.status === "active")),
  });

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["shifts", hospitalId, weekStart],
    queryFn: () =>
      apiClient
        .get(`/api/v1/staff/shifts?hospital_id=${hospitalId}&week=${weekStart}`)
        .then((r) => r.data?.shifts || r.data || []),
  });

  const assignMutation = useMutation({
    mutationFn: (body) => apiClient.post("/api/v1/staff/shifts", body),
    onSuccess: () => qc.invalidateQueries(["shifts", hospitalId, weekStart]),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/api/v1/staff/shifts/${id}`),
    onSuccess: () => qc.invalidateQueries(["shifts", hospitalId, weekStart]),
  });

  // Build shift lookup: { "date|shiftType": [shiftObjects] }
  const shiftMap = {};
  shifts.forEach((sh) => {
    const key = `${sh.date}|${sh.shift_type}`;
    if (!shiftMap[key]) shiftMap[key] = [];
    shiftMap[key].push(sh);
  });

  // Detect conflicts: same staff in overlapping shifts same day
  const conflictStaffIds = new Set();
  weekDates.forEach((date) => {
    const staffOnDay = {};
    SHIFTS.forEach((shift) => {
      const key = `${date}|${shift}`;
      (shiftMap[key] || []).forEach((sh) => {
        if (staffOnDay[sh.staff_id]) conflictStaffIds.add(`${date}|${sh.staff_id}`);
        staffOnDay[sh.staff_id] = true;
      });
    });
  });

  const autoAssign = async () => {
    if (!staffList.length) return;
    const promises = [];
    weekDates.forEach((date) => {
      SHIFTS.forEach((shiftType, si) => {
        const key = `${date}|${shiftType}`;
        if (shiftMap[key]?.length) return; // already has someone
        const staffIndex = (weekDates.indexOf(date) * 3 + si) % staffList.length;
        const staffId = staffList[staffIndex].id;
        promises.push(
          apiClient.post("/api/v1/staff/shifts", {
            staff_id: staffId,
            shift_type: shiftType,
            date,
            hospital_id: hospitalId,
          })
        );
      });
    });
    await Promise.all(promises);
    qc.invalidateQueries(["shifts", hospitalId, weekStart]);
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split("T")[0]);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().split("T")[0]);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shift Roster</h1>
        <div className="flex items-center gap-3">
          <button onClick={prevWeek} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">← Prev</button>
          <span className="text-sm font-medium text-gray-700">
            Week of {new Date(weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
          <button onClick={nextWeek} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Next →</button>
          <button
            onClick={autoAssign}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            ⚡ Auto-assign
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-3 text-left text-gray-500 font-semibold uppercase w-28">Shift</th>
                {weekDates.map((date, i) => (
                  <th key={date} className="px-2 py-3 text-center text-gray-500 font-semibold uppercase">
                    <span className="block">{DAY_LABELS[i]}</span>
                    <span className="font-normal text-gray-400">
                      {new Date(date).getDate()}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SHIFTS.map((shiftType) => (
                <tr key={shiftType} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium text-gray-700 whitespace-nowrap">
                    {SHIFT_LABELS[shiftType]}
                  </td>
                  {weekDates.map((date) => {
                    const key = `${date}|${shiftType}`;
                    const cellShifts = shiftMap[key] || [];
                    const hasConflict = cellShifts.some((sh) =>
                      conflictStaffIds.has(`${date}|${sh.staff_id}`)
                    );
                    return (
                      <td
                        key={date}
                        className={`px-2 py-2 align-top min-w-[80px] ${hasConflict ? "bg-red-50" : ""}`}
                      >
                        <div className="space-y-1">
                          {cellShifts.map((sh) => (
                            <div
                              key={sh.id}
                              className={`flex items-center justify-between rounded px-1.5 py-0.5 gap-1 ${
                                hasConflict ? "bg-red-100 text-red-800" : "bg-blue-50 text-blue-800"
                              }`}
                            >
                              <span className="truncate max-w-[60px]">{sh.staff_name?.split(" ")[0]}</span>
                              <button
                                onClick={() => removeMutation.mutate(sh.id)}
                                className="opacity-50 hover:opacity-100 font-bold leading-none"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setAssignCell({ date, shiftType })}
                            className="w-full rounded border border-dashed border-gray-300 py-0.5 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {conflictStaffIds.size > 0 && (
        <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
          ⚠️ Red cells indicate the same staff member is assigned to overlapping shifts on the same day.
        </p>
      )}

      {assignCell && (
        <AssignModal
          date={assignCell.date}
          shiftType={assignCell.shiftType}
          existingIds={(shiftMap[`${assignCell.date}|${assignCell.shiftType}`] || []).map((s) => s.staff_id)}
          staffList={staffList}
          onAssign={(staffId) =>
            assignMutation.mutate({
              staff_id: staffId,
              shift_type: assignCell.shiftType,
              date: assignCell.date,
              hospital_id: hospitalId,
            })
          }
          onClose={() => setAssignCell(null)}
        />
      )}
    </div>
  );
}
