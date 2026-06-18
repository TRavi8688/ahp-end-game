import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.hospyn.in'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
})

// Inject token
client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('reception_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Handle 401
client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('reception_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

const receptionApi = {
  // ─── Auth ───────────────────────────────────────────────────
  login: (phone, password) =>
    client.post('/api/v1/auth/login', { phone, password }).then(r => r.data),

  getMe: () =>
    client.get('/api/v1/auth/me').then(r => r.data),

  // ─── Queue ──────────────────────────────────────────────────
  getQueue: (hospitalId) =>
    client.get('/api/v1/reception/queue', { params: { hospital_id: hospitalId } }).then(r => r.data),

  callNext: (hospitalId) =>
    client.post('/api/v1/reception/queue/next', { hospital_id: hospitalId }).then(r => r.data),

  skipToken: (tokenId) =>
    client.patch(`/api/v1/reception/queue/${tokenId}/skip`).then(r => r.data),

  completeToken: (tokenId) =>
    client.patch(`/api/v1/reception/queue/${tokenId}/complete`).then(r => r.data),

  // ─── Walk-In Registration (NEW PATIENTS) ────────────────────
  registerWalkIn: (payload) =>
    client.post('/api/v1/walkin/register', payload).then(r => r.data),

  // ─── Patient Search ─────────────────────────────────────────
  searchPatients: (query) =>
    client.get('/api/v1/patients/search', { params: { q: query, limit: 20 } }).then(r => r.data),

  getPatient: (id) =>
    client.get(`/api/v1/patients/${id}`).then(r => r.data),

  // ─── Check-In (existing patient) ────────────────────────────
  checkIn: (patientId, doctorId, chiefComplaint) =>
    client.post('/api/v1/walkin/checkin', { patient_id: patientId, doctor_id: doctorId, chief_complaint: chiefComplaint }).then(r => r.data),

  // ─── Appointments ───────────────────────────────────────────
  getTodaysAppointments: (hospitalId) =>
    client.get('/api/v1/appointments', {
      params: { hospital_id: hospitalId, date: new Date().toISOString().split('T')[0] }
    }).then(r => r.data),

  updateAppointmentStatus: (id, status) =>
    client.patch(`/api/v1/appointments/${id}`, { status }).then(r => r.data),

  // ─── Billing ────────────────────────────────────────────────
  getInvoices: (hospitalId, params = {}) =>
    client.get('/api/v1/billing/invoices', { params: { hospital_id: hospitalId, ...params } }).then(r => r.data),

  getInvoice: (id) =>
    client.get(`/api/v1/billing/invoices/${id}`).then(r => r.data),

  createInvoice: (payload) =>
    client.post('/api/v1/billing/invoices', payload).then(r => r.data),

  updateInvoice: (id, payload) =>
    client.patch(`/api/v1/billing/invoices/${id}`, payload).then(r => r.data),

  recordPayment: (invoiceId, payload) =>
    client.post(`/api/v1/billing/invoices/${invoiceId}/payment`, payload).then(r => r.data),

  // ─── Doctors list (for assignment) ──────────────────────────
  getDoctors: (hospitalId) =>
    client.get('/api/v1/doctors', { params: { hospital_id: hospitalId, on_duty: true } }).then(r => r.data),

  // ─── Stats ──────────────────────────────────────────────────
  getReceptionStats: (hospitalId) =>
    client.get('/api/v1/reception/stats', { params: { hospital_id: hospitalId } }).then(r => r.data),
}

export default receptionApi
