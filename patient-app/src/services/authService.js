import axios from 'axios';
import { API_BASE_URL } from '../api';
import apiClient from './apiClient';

export const authService = {
    login: async (identifier, password) => {
    try {
        const formData = new URLSearchParams();
        formData.append('username', identifier);
        formData.append('password', password);
        const response = await axios.post(`${API_BASE_URL}/auth/login`, formData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000 // 10 seconds timeout
        });
        return response.data;
    } catch (error) {
        // Normalize error message
        const msg = error.response?.data?.message || error.response?.data?.detail || error.message || 'Login request failed.';
        throw new Error(msg);
    }
},

    googleLogin: async (credential) => {
        const response = await axios.post(`${API_BASE_URL}/auth/google`, { token: credential });
        return response.data;
    },

    appleLogin: async (identityToken) => {
        // Sends the Apple JWT identityToken to the backend to verify and mint an access_token
        const response = await axios.post(`${API_BASE_URL}/auth/apple`, { token: identityToken });
        return response.data;
    },

    // SEC-2/AUTH-FIX (2026-06-23): centralizing register/check-user/otp calls
    // here instead of scattering raw axios calls across screens, so there's
    // one place that knows the real shape of these errors.

    checkUser: async (identifier) => {
        const response = await axios.get(`${API_BASE_URL}/auth/check-user`, { params: { identifier } });
        return response.data; // { exists, verified }
    },

    register: async ({ phone, password, firstName, lastName, role = 'patient' }) => {
        const response = await axios.post(`${API_BASE_URL}/auth/register`, {
            phone_number: phone,
            password,
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`.trim(),
            role,
        });
        return response.data; // { id, role, email, phone, resumed }
    },

    sendOtp: async (phone) => {
        const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, { identifier: phone, phone, country_code: '+91', method: 'sms' });
        return response.data; // { message, resend_after_seconds }
    },

    verifyOtp: async (phone, otp) => {
        const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, { phone, otp });
        return response.data; // { access_token, user }
    },

    // Lets a Google/Apple-only user set a real Hospain ID + password.
    // Requires the access token from their current (social) session.
    setPassword: async (phone, password, accessToken) => {
        const response = await axios.post(`${API_BASE_URL}/auth/set-password`, {
            phone_number: phone,
            password,
        }, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return response.data;
    },

    setupProfile: async (payload, tempToken) => {
        // FIX-P1 (2026-06-24): this used to POST to /patient/setup-profile,
        // which doesn't exist anywhere in the backend — every registration
        // and every Google-first-login profile setup dead-ended here. The
        // real endpoint is POST /patients/, it doesn't require a hospital_id
        // anymore, and it returns the new hospyn_id wrapped in an envelope
        // ({ success, message, data: {...} }) that needs one level of
        // unwrapping.
        const response = await axios.post(`${API_BASE_URL}/patients/`, payload, {
            headers: { 'Authorization': `Bearer ${tempToken}` }
        });
        return response.data?.data || response.data;
    },

    requestForgotPassword: async (identifier) => {
        const response = await axios.post(`${API_BASE_URL}/auth/forgot-password/request`, { identifier });
        return response.data;
    },

    verifyForgotPassword: async (identifier, otp) => {
        const response = await axios.post(`${API_BASE_URL}/auth/forgot-password/verify`, { identifier, otp });
        return response.data;
    },

    resetPassword: async (resetToken, newPassword) => {
        const response = await axios.post(`${API_BASE_URL}/auth/forgot-password/reset`, {
            reset_token: resetToken,
            new_password: newPassword
        });
        return response.data;
    }
};
