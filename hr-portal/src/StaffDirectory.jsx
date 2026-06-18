import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../services/apiClient";
import useAuthStore from "../store/authStore";

const ROLES = ["doctor", "nurse", "pharmacist", "lab_tech", "admin", "receptionist"];

const STATUS_BADGE = {
  active:      "bg-green-100 text-green-800",
  on_leave:    "bg-yellow-100 text-yellow-800",
  terminated:  "bg-red-100 text-red-800",
};

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
function StaffModal({ staff, onClose, onSave }) {
  const [form, setForm] = useState(
    staff || { name: "", phone: "", role: "", department: "", join_date: "", status: "active" }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.role) {
      return setError("Name, phone, and role are required");
    }
    setLoading(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {staff ? "Edit Staff Member" : "Add New Staff"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: "Full Name *", key: "name", placeholder: "Dr. Ramesh Kumar" },
            { label: "Phone *", key: "phone", placeholder: "+91 9876543210", type: "tel" },
            { label: "Department", key: "department", placeholder: "Cardiology" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={placeholder}
                type={type || "text"}
                value={form[key] || ""}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.role || ""}
                onChange={(e) => set("role", e.target.value)}
              >
                <option value="">Select role</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="date"
                value={form.join_date || ""}
                onChange={(e) => set("join_date", e.target.value)}
              />
            </div>
          </div>

          {staff && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.status || "active"}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {staff ? "Save Changes" : "Add Staff"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── StaffDirectory ───────────────────────────────────────────────────────────
export default function StaffDirectory() {
  const hospitalId = useAuthStore((s) => s.hospitalId) || "1";
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modal, setModal] = useState(null); // null | "add" | staffObject

  const { data, isLoading } = useQuery({
    queryKey: ["staff", hospitalId],
    queryFn: () =>
      apiClient
        .get(`/api/v1/staff/hospital/${hospitalId}`)
        .then((r) => r.data?.staff || r.data || []),
  });

  const addMutation = useMutation({
    mutationFn: (body) => apiClient.post("/api/v1/staff", { ...body, hospital_id: hospitalId }),
    onSuccess: () => qc.invalidateQueries(["staff", hospitalId]),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }) => apiClient.patch(`/api/v1/staff/${id}`, body),
    onSuccess: () => qc.invalidateQueries(["staff", hospitalId]),
  });

  const deactivate = async (id) => {
    if (!confirm("Deactivate this staff member?")) return;
    await apiClient.patch(`/api/v1/staff/${id}`, { status: "terminated" });
    qc.invalidateQueries(["staff", hospitalId]);
  };

  const staff = (data || []).filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.department?.toLowerCase().includes(q) ||
      s.phone?.includes(q);
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Directory</h1>
          <p className="text-sm text-gray-500">{data?.length || 0} total staff</p>
        </div>
        <button
          onClick={() => setModal("add")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Add Staff
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by name, department, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Join Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    No staff found
                  </td>
                </tr>
              )}
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{s.role?.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-gray-500">{s.department || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.phone}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.join_date ? new Date(s.join_date).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status] || STATUS_BADGE.active}`}>
                      {s.status?.replace("_", " ") || "active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setModal(s)}
                        className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Edit
                      </button>
                      {s.status !== "terminated" && (
                        <button
                          onClick={() => deactivate(s.id)}
                          className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal === "add" && (
        <StaffModal
          onClose={() => setModal(null)}
          onSave={(form) => addMutation.mutateAsync(form)}
        />
      )}
      {modal && modal !== "add" && (
        <StaffModal
          staff={modal}
          onClose={() => setModal(null)}
          onSave={(form) => editMutation.mutateAsync({ id: modal.id, ...form })}
        />
      )}
    </div>
  );
}
