/**
 * src/stores/matrixStore.js — Hospin Matrix 3.0
 * FIXES: token from tokenStore (not localStorage), correct API URL,
 * removed duplicate login/logout, added resetAll(), added source filter,
 * 401 redirect, safe 204 handling
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { tokenStore } from "../lib/apiClient";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000") + "/api/v1";

async function apiFetch(path, options = {}) {
  const token = tokenStore.get();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    tokenStore.clear();
    sessionStorage.removeItem("hospin_token");
    sessionStorage.removeItem("hospin_user");
    if (!window.location.pathname.includes("/login")) window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const useMatrixStore = create(
  subscribeWithSelector((set, get) => ({

    // Reset all state on logout — prevents data leaking between sessions
    resetAll: () => set({
      missionMetrics: null, systemHealth: null, activityFeed: [],
      tickets: [], selectedTicket: null, ticketMessages: [], ticketNotes: [], ticketLog: [],
      ticketStats: null, ticketFilters: { status:"", priority:"", category:"", q:"", source:"" },
      ticketPage: 1, employees: [], selectedEmployee: null,
      incidents: [], selectedIncident: null, incidentTimeline: [],
      slaRules: [], slaBreaches: [], slaAtRisk: [],
      iamResults: [], verificationQueue: [], financialData: null,
      auditLogs: [], auditPage: 1, auditTotal: 0,
      broadcasts: [], hospitals: [], hospitalsPage: 1, hospitalsTotal: 0,
      employee: null,
    }),

    // UI
    activeModule: "mission", sidebarCollapsed: false, notification: null,
    setModule: (id) => set({ activeModule: id }),
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    notify: (type, message) => {
      set({ notification: { type, message } });
      setTimeout(() => set({ notification: null }), 4000);
    },

    // Current employee (set by Login.jsx via authStore, not here)
    employee: null,
    setEmployee: (emp) => set({ employee: emp }),

    // Mission Control
    missionMetrics: null, systemHealth: null, activityFeed: [], missionLoading: false,
    fetchMissionOverview: async () => {
      set({ missionLoading: true });
      try {
        const [metrics, health, feed] = await Promise.all([
          apiFetch("/matrix/mission/overview"),
          apiFetch("/matrix/mission/system-health"),
          apiFetch("/matrix/mission/activity-feed?limit=12"),
        ]);
        set({ missionMetrics: metrics.data, systemHealth: health.data, activityFeed: feed.data?.events || [], missionLoading: false });
      } catch (e) {
        set({ missionLoading: false });
        get().notify("error", `Mission overview: ${e.message}`);
      }
    },

    // Tickets
    tickets: [], selectedTicket: null, ticketMessages: [], ticketNotes: [], ticketLog: [],
    ticketStats: null, ticketsLoading: false, ticketPage: 1,
    ticketFilters: { status:"", priority:"", category:"", q:"", source:"" },
    setTicketFilters: (f) => set((s) => ({ ticketFilters: { ...s.ticketFilters, ...f }, ticketPage: 1 })),

    fetchTickets: async () => {
      set({ ticketsLoading: true });
      const { ticketFilters, ticketPage } = get();
      const p = new URLSearchParams({ page: ticketPage, limit: 50,
        ...(ticketFilters.status   ? { status:   ticketFilters.status   } : {}),
        ...(ticketFilters.priority ? { priority: ticketFilters.priority } : {}),
        ...(ticketFilters.category ? { category: ticketFilters.category } : {}),
        ...(ticketFilters.q        ? { q:        ticketFilters.q        } : {}),
        ...(ticketFilters.source   ? { source:   ticketFilters.source   } : {}),
      });
      try {
        const data = await apiFetch(`/tickets/all?${p}`);
        set({ tickets: data.tickets || [], ticketsLoading: false });
      } catch (e) { set({ ticketsLoading: false }); get().notify("error", e.message); }
    },

    selectTicket: async (ticket) => {
      set({ selectedTicket: ticket, ticketMessages: [], ticketNotes: [], ticketLog: [] });
      if (!ticket) return;
      try {
        const [msgs, notes, log] = await Promise.all([
          apiFetch(`/tickets/${ticket.ticket_id}/messages`).catch(() => ({ messages: [] })),
          apiFetch(`/tickets/${ticket.ticket_id}/internal-notes`),
          apiFetch(`/tickets/${ticket.ticket_id}/assignment-log`),
        ]);
        set({ ticketMessages: msgs.messages || [], ticketNotes: notes.notes || [], ticketLog: log.assignment_log || [] });
      } catch {}
    },

    sendMessage: async (ticketId, text, sender, senderLabel) => {
      await apiFetch(`/tickets/${ticketId}/message`, { method:"POST", body: JSON.stringify({ text, sender, sender_label: senderLabel }) });
      const msgs = await apiFetch(`/tickets/${ticketId}/messages`).catch(() => ({ messages:[] }));
      set({ ticketMessages: msgs.messages || [] });
    },

    addNote: async (ticketId, note) => {
      const emp = get().employee;
      await apiFetch(`/tickets/${ticketId}/internal-notes`, { method:"POST", body: JSON.stringify({ note, author: emp?.employee_id }) });
      const notes = await apiFetch(`/tickets/${ticketId}/internal-notes`);
      set({ ticketNotes: notes.notes || [] });
    },

    updateTicketStatus: async (ticketId, status) => {
      await apiFetch(`/tickets/${ticketId}/status`, { method:"POST", body: JSON.stringify({ status }) });
      set((s) => ({
        tickets: s.tickets.map((t) => t.ticket_id === ticketId ? { ...t, status } : t),
        selectedTicket: s.selectedTicket?.ticket_id === ticketId ? { ...s.selectedTicket, status } : s.selectedTicket,
      }));
      get().notify("success", `Ticket ${ticketId} → ${status}`);
    },

    escalateTicket: async (ticketId, note) => {
      await apiFetch(`/tickets/${ticketId}/escalate`, { method:"POST", body: JSON.stringify({ note }) });
      await get().fetchTickets();
      get().notify("success", `Ticket ${ticketId} escalated`);
    },

    createTicket: async (payload) => {
      const data = await apiFetch("/tickets/create", { method:"POST", body: JSON.stringify(payload) });
      await get().fetchTickets();
      get().notify("success", `Ticket ${data.ticket_id} created`);
      return data;
    },

    // Employees
    employees: [], selectedEmployee: null, employeesLoading: false,
    fetchEmployees: async (filters = {}) => {
      set({ employeesLoading: true });
      const p = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v)));
      try {
        const data = await apiFetch(`/matrix/employees?${p}`);
        set({ employees: data.data?.employees || [], employeesLoading: false });
      } catch (e) { set({ employeesLoading: false }); get().notify("error", e.message); }
    },

    updateShift: async (employeeId, shiftStatus, reason) => {
      const data = await apiFetch(`/matrix/employees/${employeeId}/shift`, { method:"PATCH", body: JSON.stringify({ shift_status: shiftStatus, reason }) });
      await get().fetchEmployees();
      get().notify("success", `Shift → ${shiftStatus}. ${data.data?.tickets_redistributed || 0} tickets redistributed.`);
    },

    // Incidents
    incidents: [], selectedIncident: null, incidentTimeline: [], incidentsLoading: false,
    fetchIncidents: async (filters = {}) => {
      set({ incidentsLoading: true });
      const p = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v)));
      try {
        const data = await apiFetch(`/matrix/incidents?${p}`);
        set({ incidents: data.data?.incidents || [], incidentsLoading: false });
      } catch { set({ incidentsLoading: false }); }
    },
    selectIncident: async (incident) => {
      set({ selectedIncident: incident, incidentTimeline: [] });
      if (!incident) return;
      const data = await apiFetch(`/matrix/incidents/${incident.incident_id}`);
      set({ incidentTimeline: data.data?.timeline || [] });
    },
    createIncident: async (payload) => {
      const data = await apiFetch("/matrix/incidents", { method:"POST", body: JSON.stringify(payload) });
      await get().fetchIncidents();
      get().notify("success", `Incident ${data.data?.incident_id} declared`);
      return data;
    },
    addTimelineEntry: async (incidentId, entry_type, message) => {
      await apiFetch(`/matrix/incidents/${incidentId}/timeline`, { method:"POST", body: JSON.stringify({ entry_type, message, author: get().employee?.employee_id }) });
      const data = await apiFetch(`/matrix/incidents/${incidentId}`);
      set({ incidentTimeline: data.data?.timeline || [] });
    },

    // SLA
    slaRules: [], slaBreaches: [], slaAtRisk: [],
    fetchSLAData: async () => {
      try {
        const [rules, breaches, risk] = await Promise.all([
          apiFetch("/matrix/sla/rules"), apiFetch("/matrix/sla/breaches?limit=20"), apiFetch("/matrix/sla/risk"),
        ]);
        set({ slaRules: rules.data?.rules || [], slaBreaches: breaches.data?.breaches || [], slaAtRisk: risk.data?.at_risk || [] });
      } catch {}
    },

    // IAM
    iamResults: [], iamLoading: false,
    iamSearch: async (q, entityType) => {
      set({ iamLoading: true });
      const p = new URLSearchParams({ q, ...(entityType ? { entity_type: entityType } : {}) });
      try {
        const data = await apiFetch(`/matrix/iam/search?${p}`);
        set({ iamResults: data.data?.results || [], iamLoading: false });
      } catch { set({ iamLoading: false }); }
    },
    iamAction: async (entityType, entityId, action, reason) => {
      await apiFetch(`/matrix/iam/${entityType}/${entityId}/action`, { method:"POST", body: JSON.stringify({ action, reason }) });
      get().notify("success", `${action} applied to ${entityId}`);
      await get().iamSearch(entityId, entityType);
    },

    // Verification
    verificationQueue: [],
    fetchVerificationQueue: async () => {
      try {
        const data = await apiFetch("/matrix/verification/queue");
        const rawList = data.data?.queue || [];
        const mapped = rawList.map(item => ({
          ...item,
          hospital_id: item.id,
          entity_name: item.name,
          created_at: item.submitted_at,
          assigned_verifier_id: item.verified_by,
          status: item.verification_status === 'pending_verification' ? 'submitted' : item.verification_status,
          priority: item.fraud_signals > 2 ? 'critical' : 'normal',
        }));
        set({ verificationQueue: mapped });
      } catch {}
    },
    verificationAction: async (entityType, entityId, action, reason, reviewer) => {
      await apiFetch(`/matrix/verification/${entityType}/${entityId}/action`, { method:"POST", body: JSON.stringify({ action, reason, reviewer }) });
      await get().fetchVerificationQueue();
      get().notify("success", `Verification ${action} applied`);
    },

    // Financial
    financialData: null,
    fetchFinancial: async () => {
      try { const data = await apiFetch("/matrix/financial/overview"); set({ financialData: data.data }); } catch {}
    },

    // Audit
    auditLogs: [], auditPage: 1, auditTotal: 0, auditLoading: false,
    fetchAuditLogs: async (filters = {}) => {
      set({ auditLoading: true });
      const p = new URLSearchParams({ page: get().auditPage, limit: 50, ...filters });
      try {
        const data = await apiFetch(`/matrix/audit/logs?${p}`);
        set({ auditLogs: data.data?.logs || [], auditTotal: data.data?.total || 0, auditLoading: false });
      } catch { set({ auditLoading: false }); }
    },

    // Broadcasts
    broadcasts: [],
    fetchBroadcasts: async () => {
      try { const data = await apiFetch("/matrix/broadcasts"); set({ broadcasts: data.data?.broadcasts || [] }); } catch {}
    },
    sendBroadcast: async (payload) => {
      const data = await apiFetch("/matrix/broadcasts", { method:"POST", body: JSON.stringify({ ...payload, sent_by: get().employee?.employee_id }) });
      get().notify("success", `Broadcast sent`);
      await get().fetchBroadcasts();
      return data;
    },

    // Hospitals
    hospitals: [], hospitalsPage: 1, hospitalsTotal: 0, hospitalsLoading: false,
    fetchHospitals: async (filters = {}) => {
      set({ hospitalsLoading: true });
      const p = new URLSearchParams({ page: get().hospitalsPage, limit: 30, ...filters });
      try {
        const data = await apiFetch(`/admin/hospitals?${p}`);
        set({ hospitals: data.data?.hospitals || data.hospitals || [], hospitalsTotal: data.data?.total || data.total || 0, hospitalsLoading: false });
      } catch { set({ hospitalsLoading: false }); }
    },
    hospitalAction: async (hospitalId, action, reason) => {
      await apiFetch(`/matrix/iam/hospital/${hospitalId}/action`, { method:"POST", body: JSON.stringify({ action, reason }) });
      await get().fetchHospitals();
      get().notify("success", `Hospital ${action} applied`);
    },
  }))
);
