import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../services/apiClient";
import useAuthStore from "../store/authStore";

// ─── Star rating component (half-star support) ────────────────────────────────
function StarRating({ value, onChange, readonly }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex gap-0.5">
      {stars.map((star) => {
        const filled = value >= star;
        const half = !filled && value >= star - 0.5;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && onChange?.(star)}
            className={`text-2xl transition-colors ${readonly ? "cursor-default" : "cursor-pointer"}`}
          >
            <span className={filled ? "text-yellow-400" : half ? "text-yellow-300" : "text-gray-300"}>
              ★
            </span>
          </button>
        );
      })}
      {!readonly && <span className="ml-1 text-sm text-gray-500">{value}/5</span>}
    </div>
  );
}

// ─── ReviewModal ──────────────────────────────────────────────────────────────
function ReviewModal({ staff, onClose, onSubmit }) {
  const [form, setForm] = useState({
    attendance_score: 4,
    patient_satisfaction: 4,
    punctuality: 4,
    skills_rating: 4,
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const overallScore =
    (form.attendance_score + form.patient_satisfaction + form.punctuality + form.skills_rating) / 4;
  const needsPIP = overallScore < 2.5;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({ ...form, overall_score: overallScore });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const RatingRow = ({ label, field }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100">
      <span className="text-sm font-medium text-gray-700 w-44">{label}</span>
      <StarRating value={form[field]} onChange={(v) => set(field, v)} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Performance Review</h3>
            <p className="text-sm text-gray-500">{staff.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <div className="p-6 space-y-1">
          <RatingRow label="Attendance Score" field="attendance_score" />
          <RatingRow label="Patient Satisfaction" field="patient_satisfaction" />
          <RatingRow label="Punctuality" field="punctuality" />
          <RatingRow label="Skills Rating" field="skills_rating" />

          <div className="pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Overall Score</span>
              <span className={`text-lg font-bold ${needsPIP ? "text-red-600" : "text-green-600"}`}>
                {overallScore.toFixed(1)} / 5
              </span>
            </div>
            {needsPIP && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-3">
                ⚠️ Score below 2.5 — this staff member will be flagged for a <strong>Performance Improvement Plan</strong>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Additional feedback…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HistoryModal ─────────────────────────────────────────────────────────────
function HistoryModal({ staff, reviews, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Review History — {staff.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <div className="p-6 max-h-96 overflow-y-auto space-y-4">
          {reviews.length === 0 && <p className="text-gray-400 text-center py-4">No reviews yet</p>}
          {reviews.map((r, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">
                  {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("en-IN") : "—"}
                </span>
                <span className={`font-bold text-lg ${r.overall_score < 2.5 ? "text-red-600" : "text-green-600"}`}>
                  {r.overall_score?.toFixed(1)} ★
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                <span>Attendance: {r.attendance_score}/5</span>
                <span>Satisfaction: {r.patient_satisfaction}/5</span>
                <span>Punctuality: {r.punctuality}/5</span>
                <span>Skills: {r.skills_rating}/5</span>
              </div>
              {r.notes && <p className="text-xs text-gray-400 mt-2 italic">"{r.notes}"</p>}
              {r.overall_score < 2.5 && (
                <p className="text-xs text-red-500 mt-1 font-medium">🚩 PIP Flagged</p>
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PerformanceReview ────────────────────────────────────────────────────────
export default function PerformanceReview() {
  const hospitalId = useAuthStore((s) => s.hospitalId) || "1";
  const qc = useQueryClient();
  const [reviewTarget, setReviewTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", hospitalId],
    queryFn: () =>
      apiClient
        .get(`/api/v1/staff/hospital/${hospitalId}`)
        .then((r) => (r.data?.staff || r.data || []).filter((s) => s.status === "active")),
  });

  const { data: allReviews = {} } = useQuery({
    queryKey: ["reviews", hospitalId],
    queryFn: () =>
      apiClient
        .get(`/api/v1/staff/performance-reviews?hospital_id=${hospitalId}`)
        .then((r) => {
          const map = {};
          (r.data?.reviews || r.data || []).forEach((rev) => {
            if (!map[rev.staff_id]) map[rev.staff_id] = [];
            map[rev.staff_id].push(rev);
          });
          return map;
        })
        .catch(() => ({})),
  });

  const submitMutation = useMutation({
    mutationFn: ({ staffId, body }) =>
      apiClient.post(`/api/v1/staff/${staffId}/performance-review`, body),
    onSuccess: () => qc.invalidateQueries(["reviews", hospitalId]),
  });

  const getLastReview = (staffId) => {
    const reviews = allReviews[staffId] || [];
    return reviews.sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))[0];
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Performance Reviews</h1>

      {isLoading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Staff</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-center">Last Review</th>
                <th className="px-4 py-3 text-center">Rating</th>
                <th className="px-4 py-3 text-center">Flag</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">No active staff</td>
                </tr>
              )}
              {staff.map((s) => {
                const last = getLastReview(s.id);
                const needsPIP = last && last.overall_score < 2.5;
                return (
                  <tr key={s.id} className={`hover:bg-gray-50 ${needsPIP ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{s.role?.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {last
                        ? new Date(last.reviewed_at).toLocaleDateString("en-IN")
                        : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {last ? (
                        <div className="flex items-center justify-center gap-1">
                          <StarRating value={last.overall_score} readonly />
                          <span className="text-xs text-gray-500">{last.overall_score?.toFixed(1)}</span>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {needsPIP && (
                        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
                          🚩 PIP
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setReviewTarget(s)}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => setHistoryTarget(s)}
                          className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reviewTarget && (
        <ReviewModal
          staff={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={(body) =>
            submitMutation.mutateAsync({ staffId: reviewTarget.id, body })
          }
        />
      )}

      {historyTarget && (
        <HistoryModal
          staff={historyTarget}
          reviews={allReviews[historyTarget.id] || []}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
