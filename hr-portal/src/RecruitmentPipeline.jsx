import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../services/apiClient";
import useAuthStore from "../store/authStore";

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"];
const STAGE_LABELS = {
  applied:   { label: "Applied",    color: "bg-gray-100 text-gray-700",   border: "border-gray-200" },
  screening: { label: "Screening",  color: "bg-blue-100 text-blue-700",   border: "border-blue-200" },
  interview: { label: "Interview",  color: "bg-purple-100 text-purple-700", border: "border-purple-200" },
  offer:     { label: "Offer Sent", color: "bg-yellow-100 text-yellow-700", border: "border-yellow-200" },
  hired:     { label: "Hired ✓",   color: "bg-green-100 text-green-700",  border: "border-green-200" },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700",     border: "border-red-200" },
};

const ROLES = ["doctor", "nurse", "pharmacist", "lab_tech", "admin", "receptionist"];

// ─── New Job Modal ─────────────────────────────────────────────────────────────
function NewJobModal({ onClose, onSave, hospitalId }) {
  const [form, setForm] = useState({ title: "", role: "", department: "", vacancies: 1, description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.role) return setError("Title and role are required");
    setLoading(true);
    setError("");
    try {
      await onSave({ ...form, hospital_id: hospitalId });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to post job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Post New Job</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Senior Nurse – ICU" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.role} onChange={(e) => set("role", e.target.value)}>
                <option value="">Select…</option>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vacancies</label>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="number" min="1" value={form.vacancies} onChange={(e) => set("vacancies", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Cardiology" value={form.department} onChange={(e) => set("department", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3} placeholder="Job requirements, experience needed…"
              value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            Post Job
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Applicant Card ────────────────────────────────────────────────────────────
function ApplicantCard({ applicant, onMove }) {
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow-sm p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900 text-sm">{applicant.name}</p>
          <p className="text-xs text-gray-500">{applicant.phone}</p>
        </div>
        {applicant.experience_years && (
          <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 whitespace-nowrap">
            {applicant.experience_years}y exp
          </span>
        )}
      </div>
      {applicant.notes && (
        <p className="text-xs text-gray-400 italic truncate">"{applicant.notes}"</p>
      )}
      <div className="flex flex-wrap gap-1">
        {STAGES.filter((s) => s !== applicant.stage).slice(0, 3).map((s) => (
          <button key={s} onClick={() => onMove(applicant.id, s)}
            className="text-xs rounded px-1.5 py-0.5 bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 transition-colors">
            → {STAGE_LABELS[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── RecruitmentPipeline ───────────────────────────────────────────────────────
export default function RecruitmentPipeline() {
  const hospitalId = useAuthStore((s) => s.hospitalId) || "1";
  const qc = useQueryClient();
  const [showNewJob, setShowNewJob] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs", hospitalId],
    queryFn: () =>
      apiClient.get(`/api/v1/recruitment/jobs?hospital_id=${hospitalId}`)
        .then((r) => r.data?.jobs || r.data || [])
        .catch(() => []),
  });

  const { data: applicants = [] } = useQuery({
    queryKey: ["applicants", selectedJob?.id],
    enabled: !!selectedJob,
    queryFn: () =>
      apiClient.get(`/api/v1/recruitment/jobs/${selectedJob.id}/applicants`)
        .then((r) => r.data?.applicants || r.data || [])
        .catch(() => []),
  });

  const createJobMutation = useMutation({
    mutationFn: (body) => apiClient.post("/api/v1/recruitment/jobs", body),
    onSuccess: () => qc.invalidateQueries(["jobs", hospitalId]),
  });

  const moveStageMutation = useMutation({
    mutationFn: ({ applicantId, stage }) =>
      apiClient.patch(`/api/v1/recruitment/applicants/${applicantId}`, { stage }),
    onSuccess: () => qc.invalidateQueries(["applicants", selectedJob?.id]),
  });

  const stageGroups = STAGES.reduce((acc, s) => {
    acc[s] = applicants.filter((a) => a.stage === s);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recruitment Pipeline</h1>
        <button onClick={() => setShowNewJob(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          + Post Job
        </button>
      </div>

      {/* Job list */}
      {jobsLoading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {jobs.length === 0 && (
            <div className="col-span-3 rounded-xl bg-white shadow-sm p-10 text-center text-gray-400">
              No open positions. Click "+ Post Job" to add one.
            </div>
          )}
          {jobs.map((job) => (
            <button key={job.id} onClick={() => setSelectedJob(job)}
              className={`text-left rounded-xl border-2 p-4 shadow-sm transition-all hover:shadow-md ${
                selectedJob?.id === job.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
              }`}>
              <p className="font-semibold text-gray-900">{job.title}</p>
              <p className="text-sm text-gray-500 capitalize mt-0.5">{job.role?.replace("_", " ")} · {job.department || "General"}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{job.vacancies || 1} vacancy</span>
                <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                  {applicants.filter((a) => a.job_id === job.id).length || "—"} applicants
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Kanban pipeline */}
      {selectedJob && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Pipeline — {selectedJob.title}
            </h2>
            <button onClick={() => setSelectedJob(null)} className="text-sm text-gray-400 hover:text-gray-600">
              ✕ Close
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const cfg = STAGE_LABELS[stage];
              return (
                <div key={stage} className={`flex-shrink-0 w-52 rounded-xl border ${cfg.border} bg-gray-50 p-3`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-gray-400">{stageGroups[stage]?.length || 0}</span>
                  </div>
                  <div className="space-y-2">
                    {(stageGroups[stage] || []).map((a) => (
                      <ApplicantCard key={a.id} applicant={a}
                        onMove={(id, newStage) => moveStageMutation.mutate({ applicantId: id, stage: newStage })} />
                    ))}
                    {(stageGroups[stage] || []).length === 0 && (
                      <p className="text-xs text-gray-300 text-center py-4">Empty</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showNewJob && (
        <NewJobModal
          hospitalId={hospitalId}
          onClose={() => setShowNewJob(false)}
          onSave={(body) => createJobMutation.mutateAsync(body)}
        />
      )}
    </div>
  );
}
