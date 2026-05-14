import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = "https://hospyn-api-625745217419.asia-south1.run.app/api/v1";

class ApiService {
    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            timeout: 15000,
            headers: { 'Content-Type': 'application/json' }
        });

        this.client.interceptors.request.use(async (config) => {
            const token = await SecureStore.getItemAsync('hospyn_auth_token');
            if (token) config.headers.Authorization = `Bearer ${token}`;
            
            // AUTOMATIC IDEMPOTENCY (Section 3.3)
            if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
                config.headers['X-Idempotency-Key'] = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            }
            return config;
        });
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

    async getAnalytics() {
        return (await this.client.get('/doctor/analytics/summary')).data;
    }
}

export default new ApiService();
