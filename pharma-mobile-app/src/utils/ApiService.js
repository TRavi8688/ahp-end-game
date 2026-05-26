import axios from 'axios';

// Update this to your local backend IP if testing on a physical device
export const API_BASE_URL = 'http://localhost:8000/api/v1';

let authToken = null;

class ApiService {
    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
            }
        });

        this.client.interceptors.request.use(async (config) => {
            if (authToken) {
                config.headers.Authorization = `Bearer ${authToken}`;
            }
            return config;
        });
    }

    setToken(token) {
        authToken = token;
    }

    async get(url, config = {}) { return await this.client.get(url, config); }
    async post(url, data = {}, config = {}) { return await this.client.post(url, data, config); }
}

export default new ApiService();
