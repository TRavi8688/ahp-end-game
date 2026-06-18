import apiClient from './apiClient';

export const authService = {
    /**
     * Standard Login (OAuth2 form data format for FastAPI)
     */
    login: async (username, password) => {
        return apiClient.post('/auth/login', { username, password });
    },

    /**
     * Verify Token Check
     */
    verifyToken: async () => {
        return apiClient.get('/auth/me');
    },

    /**
     * Request a password reset OTP
     */
    requestPasswordReset: async (email) => {
        return apiClient.post('/auth/forgot-password/request', { email });
    },

    /**
     * Send OTP for Login
     */
    sendOTP: async (identifier, method) => {
        return apiClient.post('/auth/send-otp', { identifier, method });
    },

    /**
     * Verify OTP for password reset
     */
    verifyPasswordResetOTP: async (email, otp) => {
        return apiClient.post('/auth/forgot-password/verify', { email, otp });
    },

    /**
     * Reset Password
     */
    resetPassword: async (resetToken, newPassword) => {
        return apiClient.post('/auth/forgot-password/reset', { reset_token: resetToken, new_password: newPassword });
    }
};
