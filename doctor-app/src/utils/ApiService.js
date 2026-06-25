import axios from 'axios';
import { API_BASE_URL } from '../api';

// FIXED: same systemic missing-prefix bug as apiClient.js — healthcare-core
// mounts everything under /api/v1/healthcare/*.
const PASSTHROUGH_PREFIXES = ['/auth', '/ai', '/notifications', '/healthcare'];
function withHealthcarePrefix(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith('/') ? url : `/${url}`;
  if (PASSTHROUGH_PREFIXES.some((p) => normalized.startsWith(p))) return url;
  return `/healthcare${normalized}`;
}

class ApiService {
    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            timeout: 15000,
            headers: { 'Content-Type': 'application/json' }
        });

        this.client.interceptors.request.use(async (config) => {
            const token = sessionStorage.getItem('hospain_access_token');
            if (token) config.headers.Authorization = `Bearer ${token}`;
            
            // AUTOMATIC IDEMPOTENCY (Section 3.3)
            if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
                config.headers['X-Idempotency-Key'] = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            }
            // FIXED ORDER: prefix rewrite must happen before the leading
            // slash is stripped (the passthrough check depends on it).
            config.url = withHealthcarePrefix(config.url);
            if (config.url && config.url.startsWith('/')) {
                config.url = config.url.substring(1);
            }
            return config;
        });

        this.onAuthFailure = null;

        // Global Error Handler
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    console.error("AUTH_FAILURE: Doctor session expired.");
                    sessionStorage.removeItem('hospain_access_token');
                    if (this.onAuthFailure) {
                        this.onAuthFailure();
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    setAuthFailureCallback(callback) {
        this.onAuthFailure = callback;
    }

    // --- Doctor Specific Endpoints ---
    async getAssignedPatients() {
        return (await this.client.get('/doctor/patients')).data;
    }

    async getPatientTimeline(patientId) {
        return (await this.client.get(`/doctor/patient/${patientId}/timeline`)).data;
    }

    async issuePrescription(data) {
        return (await this.client.post('/doctor/prescription/create', data)).data;
    }

    // --- Generic HTTP Methods ---
    async get(url, config = {}) {
        return (await this.client.get(url, config)).data;
    }

    async post(url, data = {}, config = {}) {
        return (await this.client.post(url, data, config)).data;
    }

    async getAnalytics() {
        return (await this.client.get('/doctor/analytics/summary')).data;
    }
}

export default new ApiService();
