import apiClient from './apiClient';

/**
 * appointmentService
 * Connects the patient app to all doctor-booking and queue endpoints.
 *
 * Backend routes (healthcare-core):
 *   GET  /api/v1/doctors/search        — search doctors by specialty / hospital
 *   GET  /api/v1/doctors/:id/slots     — available appointment slots
 *   POST /api/v1/appointments          — book an appointment
 *   GET  /api/v1/appointments          — patient's appointment list
 *   GET  /api/v1/appointments/:id      — single appointment detail
 *   POST /api/v1/appointments/:id/cancel
 *   GET  /api/v1/queue/status/:token   — live queue position (polling fallback)
 */
export const appointmentService = {
  /**
   * Search doctors.
   * @param {object} params  { specialty, hospital_id, name, date }
   */
  searchDoctors: async (params = {}, signal) => {
    const response = await apiClient.get('/api/v1/doctors/search', { params, signal });
    return response.data; // { doctors: [...] }
  },

  /**
   * Get available slots for a doctor on a given date.
   * @param {string} doctorId
   * @param {string} date  ISO date string e.g. "2026-06-10"
   */
  getDoctorSlots: async (doctorId, date, signal) => {
    const response = await apiClient.get(`/api/v1/doctors/${doctorId}/slots`, {
      params: { date },
      signal,
    });
    return response.data; // { slots: [{ time, available }] }
  },

  /**
   * Book an appointment.
   * @param {object} payload  { doctor_id, slot_time, notes, payment_method }
   * Returns { appointment_id, queue_token, payment_url? }
   */
  bookAppointment: async (payload) => {
    const response = await apiClient.post('/api/v1/appointments', payload);
    return response.data;
  },

  /**
   * Get this patient's appointments (upcoming + past).
   */
  getAppointments: async (signal) => {
    const response = await apiClient.get('/api/v1/appointments', { signal });
    return response.data;
  },

  /**
   * Get a single appointment with full doctor + billing details.
   */
  getAppointmentDetail: async (appointmentId, signal) => {
    const response = await apiClient.get(`/api/v1/appointments/${appointmentId}`, { signal });
    return response.data;
  },

  /**
   * Cancel an appointment.
   */
  cancelAppointment: async (appointmentId, reason = '') => {
    const response = await apiClient.post(`/api/v1/appointments/${appointmentId}/cancel`, { reason });
    return response.data;
  },

  /**
   * Get live queue position for a queue token.
   * Used by QueueStatusScreen as a polling fallback when WebSocket is unavailable.
   * @param {string} token  — returned from bookAppointment
   */
  getQueueStatus: async (token, signal) => {
    const response = await apiClient.get(`/api/v1/queue/status/${token}`, { signal });
    return response.data; // { position, estimated_wait_minutes, status }
  },
};
