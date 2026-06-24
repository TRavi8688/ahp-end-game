import apiClient from './apiClient';

/**
 * appointmentService
 * Connects the patient app to doctor-listing, booking, and queue endpoints.
 *
 * FIX-A1 (2026-06-24): every call in this file had `/api/v1` hardcoded in
 * the path on top of apiClient's baseURL already including `/api/v1` —
 * every single request here 404'd, always, for everyone. Paths below are
 * also corrected to match what the backend actually exposes (there is no
 * `/doctors/search` — doctor listing/filtering lives at bare `GET /doctors/`
 * with a `specialization` param, not `specialty`), and responses are
 * unwrapped from the backend's `{success, message, data}` envelope.
 *
 * Backend routes (healthcare-core):
 *   GET  /doctors/                — list/filter doctors (hospital_id, specialization)
 *   POST /appointments/           — book an appointment
 *   GET  /appointments/           — patient's appointment list
 *   GET  /appointments/:id        — single appointment detail
 *   POST /appointments/:id/cancel
 *   GET  /walkin/status/:request_id — live queue position
 */
export const appointmentService = {
  /**
   * List/filter doctors.
   * @param {object} params  { specialization, hospital_id }
   */
  searchDoctors: async (params = {}, signal) => {
    // FIX-A1: backend param is "specialization", not "specialty".
    const { specialty, ...rest } = params;
    const queryParams = specialty ? { ...rest, specialization: specialty } : rest;
    const response = await apiClient.get('/doctors/', { params: queryParams, signal });
    const data = response.data?.data || response.data;
    return { doctors: data?.items || [] };
  },

  /**
   * FIX-A1: there is currently no backend endpoint for per-doctor available
   * slots — the underlying `doctor_availability` table isn't even
   * provisioned in this codebase yet (the doctor-side endpoint that writes
   * to it has its own fallback for "table missing"). Booking a specific
   * pre-vetted time slot isn't possible to wire up safely right now; this
   * needs a real product decision (build proper slot-booking, or have
   * patients request a date/time directly and rely on the backend's
   * scheduling-conflict check) before this can be implemented for real.
   * Throwing clearly instead of silently returning fake data.
   */
  getDoctorSlots: async (_doctorId, _date, _signal) => {
    throw new Error('Slot lookup is not available yet — see appointmentService.js FIX-A1 note.');
  },

  /**
   * Book an appointment.
   * @param {object} payload  { patient_id, doctor_id, hospital_id, scheduled_at, duration_minutes?, appointment_type?, chief_complaint? }
   */
  bookAppointment: async (payload) => {
    const response = await apiClient.post('/appointments/', payload);
    return response.data?.data || response.data;
  },

  /**
   * Get this patient's appointments (upcoming + past).
   */
  getAppointments: async (signal) => {
    const response = await apiClient.get('/appointments/', { signal });
    const data = response.data?.data || response.data;
    return { appointments: data?.items || [], total: data?.total };
  },

  /**
   * Get a single appointment with full doctor + billing details.
   */
  getAppointmentDetail: async (appointmentId, signal) => {
    const response = await apiClient.get(`/appointments/${appointmentId}`, { signal });
    return response.data?.data || response.data;
  },

  /**
   * Cancel an appointment.
   */
  cancelAppointment: async (appointmentId, reason = '') => {
    const response = await apiClient.post(`/appointments/${appointmentId}/cancel`, { reason });
    return response.data?.data || response.data;
  },

  /**
   * Get live queue position. FIX-A1: this used to call /api/v1/queue/status,
   * which never existed. The real endpoint is the walk-in system's
   * GET /walkin/status/{request_id} (see round-1 changelog) — and it wraps
   * its response in the same {success, data} envelope.
   */
  getQueueStatus: async (requestId, signal) => {
    const response = await apiClient.get(`/walkin/status/${requestId}`, { signal });
    return response.data?.data || response.data; // { position_in_queue, estimated_wait_minutes, queue_state, ... }
  },
};
