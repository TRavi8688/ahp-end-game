import axios from 'axios';
import { API_BASE_URL } from '../api';

class ApiService {
    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            timeout: 15000,
            headers: { 'Content-Type': 'application/json' }
        });

        this.client.interceptors.request.use(async (config) => {
            const token = localStorage.getItem('token');
            if (token) config.headers.Authorization = `Bearer ${token}`;
            
            // AUTOMATIC IDEMPOTENCY (Section 3.3)
            if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
                config.headers['X-Idempotency-Key'] = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
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
                    localStorage.removeItem('token');
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
