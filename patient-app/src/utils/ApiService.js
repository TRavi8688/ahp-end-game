/**
 * src/utils/ApiService.js
 *
 * FIX 1: baseURL had /api/v1 suffix from EXPO_PUBLIC_API_BASE_URL AND service
 *         paths also started with /api/v1/healthcare/... → double prefix.
 *         Now strips /api/v1 from baseURL.
 *
 * FIX 2: Added requestPhoneOtp() and verifyPhoneOtp() — called by SettingsScreen
 *         Phone OTP modal but were never implemented (setTimeout stubs before).
 *
 * FIX 3: Added deleteAccount() wired to real backend endpoint.
 */

import axios from 'axios';
import { SecurityUtils } from './security';

// Root URL (no /api/v1 suffix)
const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL
    ? process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/api\/v1\/?$/, '')
    : 'http://localhost:8000';

// Zero-footprint ephemeral cache
const SessionMemoryCache = new Map();

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Inject auth headers
    this.client.interceptors.request.use(async (config) => {
      const token = await SecurityUtils.getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;

      const activeMemberId = await SecurityUtils.getActiveMemberId();
      if (activeMemberId) config.headers['X-Family-Member-ID'] = activeMemberId;

      if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
        config.headers['X-Idempotency-Key'] =
          `hospyn_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      }
      return config;
    });

    this.onAuthFailure = null;

    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        const { config, response } = error;
        if (response?.status >= 500 && config) {
          config.__retryCount = config.__retryCount || 0;
          if (config.__retryCount < 3) {
            config.__retryCount += 1;
            const delay = Math.pow(2, config.__retryCount) * 1000;
            await new Promise(r => setTimeout(r, delay));
            return this.client(config);
          }
        }
        if (response?.status === 401 && this.onAuthFailure) {
          this.onAuthFailure();
        }
        return Promise.reject(error);
      }
    );
  }

  // ── Profile ─────────────────────────────────────────────────────────────────

  async getProfile() {
    const res = await this.client.get('/api/v1/healthcare/patients/profile');
    SessionMemoryCache.set('profile', res.data);
    return res.data;
  }

  async updateProfile(data) {
    const res = await this.client.post('/api/v1/healthcare/patients/profile/update', data);
    const current = SessionMemoryCache.get('profile') || {};
    SessionMemoryCache.set('profile', { ...current, ...data });
    return res.data;
  }

  // ── Phone OTP (NEW — called by SettingsScreen) ────────────────────────────

  async requestPhoneOtp(phoneNumber) {
    const res = await this.client.post('/api/v1/auth/phone/request-otp', {
      phone_number: phoneNumber,
    });
    return res.data;
  }

  async verifyPhoneOtp(phoneNumber, otp) {
    const res = await this.client.post('/api/v1/auth/phone/verify-otp', {
      phone_number: phoneNumber,
      otp,
    });
    return res.data;
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async exportProfileData() {
    const res = await this.client.post('/api/v1/healthcare/patients/export');
    return res.data;
  }

  // ── Account Deletion ──────────────────────────────────────────────────────

  async deleteAccount() {
    const res = await this.client.delete('/api/v1/healthcare/patients/me');
    return res.data;
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  async getNotifications(signal) {
    const res = await this.client.get('/api/v1/healthcare/patients/notifications', { signal });
    return res.data;
  }

  // ── Health Summary ────────────────────────────────────────────────────────

  async getHealthSummary(signal) {
    const cacheKey = 'health_summary';
    try {
      const res = await this.client.get('/api/v1/healthcare/patients/clinical-summary', { signal });
      SessionMemoryCache.set(cacheKey, res.data);
      return res.data;
    } catch (e) {
      const cached = SessionMemoryCache.get(cacheKey);
      if (cached) return cached;
      throw e;
    }
  }

  // ── Vitals ────────────────────────────────────────────────────────────────

  async getVitals(signal) {
    const res = await this.client.get('/api/v1/healthcare/patients/vitals', { signal });
    return res.data;
  }

  // ── Family Members ────────────────────────────────────────────────────────

  async getFamilyMembers() {
    const res = await this.client.get('/api/v1/healthcare/patients/family');
    return res.data;
  }

  // ── Appointments ──────────────────────────────────────────────────────────

  async getAppointments(signal) {
    const res = await this.client.get('/api/v1/healthcare/appointments', { signal });
    return res.data;
  }

  async bookAppointment(data) {
    const res = await this.client.post('/api/v1/healthcare/appointments/book', data);
    return res.data;
  }

  async cancelAppointment(appointmentId) {
    const res = await this.client.post(`/api/v1/healthcare/appointments/${appointmentId}/cancel`);
    return res.data;
  }

  // ── QR Walk-In ────────────────────────────────────────────────────────────

  async scanHospitalQR(qrData) {
    const res = await this.client.post('/api/v1/healthcare/walkin/scan', { qr_data: qrData });
    return res.data;
  }

  // ── Billing ───────────────────────────────────────────────────────────────

  async getInvoices(signal) {
    const res = await this.client.get('/api/v1/healthcare/billing/invoices', { signal });
    return res.data;
  }

  async getInvoiceDetail(invoiceId) {
    const res = await this.client.get(`/api/v1/healthcare/billing/invoices/${invoiceId}`);
    return res.data;
  }
}

export default new ApiService();
