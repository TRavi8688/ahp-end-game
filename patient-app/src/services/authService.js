import axios from 'axios';
import { API_BASE_URL } from '../api';
import apiClient from './apiClient';

export const authService = {
    login: async (identifier, password) => {
        const formData = new URLSearchParams();
        formData.append('username', identifier);
        formData.append('password', password);

        const response = await axios.post(`${API_BASE_URL}/auth/login`, formData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data;
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

    setupProfile: async (payload, tempToken) => {
        // setupProfile requires idempotency and proper auth headers handling, but we have a temp token.
        // It's safer to use raw axios to avoid apiClient overriding anything or failing.
        const response = await axios.post(`${API_BASE_URL}/patient/setup-profile`, payload, {
            headers: { 'Authorization': `Bearer ${tempToken}` }
        });
        return response.data;
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
