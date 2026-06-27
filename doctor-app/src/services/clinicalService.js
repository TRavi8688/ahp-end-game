import apiClient from './apiClient';

export const clinicalService = {
    /**
     * Fetch all patients assigned to the doctor
     */
    getMyPatients: async (signal) => {
        return apiClient.get('/doctor/my-patients', { signal });
    },

    /**
     * Fetch live active queue of patients
     */
    getActiveQueue: async (signal) => {
        return apiClient.get('/doctor/queue', { signal });
    },

    /**
     * Start consultation for a specific walk-in patient (the "next" one,
     * as already determined by the UI from the queue list — see
     * QueueScreen.jsx's nextPatient).
     *
     * FIXED: this used to call workflow.py's POST /queue/session/start and
     * POST /queue/token/advance — a completely separate queue system built
     * on a `PatientToken` table that nothing ever populates for walk-in
     * patients. Calling it always succeeded (no 404) but did nothing
     * visible: it operated on an empty, unrelated table while the actual
     * queue shown on screen (GET /doctor/queue) is built on WalkInRequest.
     * "Call Next" would silently no-op ("No patients waiting.") even with
     * a full visible queue.
     *
     * The real walk-in flow has no separate "start my session" step — a
     * doctor can act on any assigned/unassigned walk-in as soon as they're
     * logged in — so starting a session is just starting that patient's
     * consultation directly.
     */
    startConsultation: async (walkinId) => {
        return apiClient.patch(`/doctor/queue/${walkinId}/start`, {});
    },

    /**
     * Complete a consultation: saves chief complaint, clinical notes,
     * diagnosis (all persisted on the encrypted Appointment columns), and
     * creates the structured Prescription in one transactional call —
     * then advances the walk-in to "completed" and broadcasts the
     * WebSocket update.
     *
     * FIXED: replaces the previous fictional /consultations call (no such
     * route exists) and the disconnected workflow.py
     * POST /queue/token/{id}/complete.
     */
    completeConsultation: async (walkinId, { chiefComplaint, clinicalNotes, diagnosis, items } = {}) => {
        return apiClient.patch(`/doctor/queue/${walkinId}/complete`, {
            chief_complaint: chiefComplaint || null,
            clinical_notes: clinicalNotes || null,
            diagnosis: diagnosis || null,
            prescription_items: items && items.length ? items : null,
        });
    },

    /**
     * Fetch a specific patient's full chart by their Patient.id directly
     * — does NOT require the patient to have an active walk-in today.
     *
     * FIXED: was calling GET /doctor/patient/{hospynId}, but that route's
     * {walkin_id} path param is strictly UUID-typed and refers to a
     * walk-in queue entry, not a patient. PatientList.jsx and
     * PatientSearch.jsx only ever have a Patient.id or Hospain ID to work
     * with — neither is a walkin_id — so every call here always 422'd.
     * The new GET /doctor/patient-record/{patient_id} endpoint
     * (doctor_queue.py) is built for exactly this case, scoped to
     * patients registered at the doctor's own hospital.
     */
    getPatientDetails: async (patientId, signal) => {
        return apiClient.get(`/doctor/patient-record/${patientId}`, { signal });
    },

    /**
     * Create a standalone prescription for a patient, outside of a
     * consultation-completion flow (e.g. a refill, or a follow-up
     * prescription written between visits).
     *
     * FIXED: backend's PrescriptionCreate schema (prescriptions.py) requires
     * { patient_id, items: [{drug_name, dosage, frequency, duration,
     * instructions}], walkin_request_id? } — this was sending
     * "prescription_items" (FastAPI/Pydantic only reads "items", so the
     * whole request 422'd: "field required: items").
     *
     * NOTE: this endpoint's Prescription model has no diagnosis or
     * clinical_notes columns — those fields belong to the *consultation*
     * (Appointment.diagnosis / Appointment.clinical_notes, both
     * encrypted), saved via completeConsultation() above, not here. Use
     * completeConsultation() when finishing a visit with the patient
     * physically present; use this only for a prescription with no
     * attached consultation record.
     */
    createPrescription: async (patientId, { items, walkinRequestId } = {}) => {
        // NOTE: trailing slash matters here — the real route is
        // POST /prescriptions/ (registered with prefix="/prescriptions" and
        // an empty-string path). Without it, FastAPI 307-redirects, which
        // most clients follow correctly but is an avoidable extra round
        // trip some proxies mishandle.
        return apiClient.post('/prescriptions/', {
            patient_id: patientId,
            walkin_request_id: walkinRequestId,
            items,
        });
    },

    /**
     * Order a lab test — POST /lab-orders
     * NOTE: this is currently NOT a real backend endpoint. A LabOrder
     * model exists (app/models/lab.py) but no route creates one yet.
     * Not called from any page today — kept as a clearly-marked stub for
     * when that backend work lands, rather than silently removed and
     * forgotten.
     */
    orderLabTest: async (patientId, testName, notes) => {
        throw new Error('Lab ordering is not available yet — no backend endpoint exists for this.');
    },

    /**
     * Search medicines from drug database
     */
    searchMedicines: async (query) => {
        return apiClient.get('/medicines/search', { params: { q: query } });
    },

    /**
     * Get doctor's earnings summary
     */
    getEarnings: async (period = 'month') => {
        return apiClient.get('/doctor/earnings', { params: { period } });
    },

    /**
     * Get doctor's availability slots
     */
    getAvailability: async () => {
        return apiClient.get('/doctor/availability');
    },

    /**
     * Set doctor's availability
     */
    setAvailability: async (slots) => {
        return apiClient.put('/doctor/availability', { slots });
    },

    /**
     * Mark a day off / leave
     */
    markLeave: async (leaveData) => {
        return apiClient.post('/doctor/leave', leaveData);
    },

    /**
     * Get all leave records
     */
    getLeaveHistory: async () => {
        return apiClient.get('/doctor/leave');
    },

    /**
     * Cancel a leave
     */
    cancelLeave: async (leaveId) => {
        return apiClient.delete(`/doctor/leave/${leaveId}`);
    },

    /**
     * Get notifications
     */
    getNotifications: async () => {
        return apiClient.get('/doctor/notifications');
    },

    /**
     * Mark notification as read
     */
    markNotificationRead: async (notificationId) => {
        return apiClient.patch(`/doctor/notifications/${notificationId}/read`, {});
    },

    /**
     * Mark all notifications as read
     */
    markAllNotificationsRead: async () => {
        return apiClient.post('/doctor/notifications/read-all', {});
    },
};
