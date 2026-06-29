import apiClient from './apiClient';

// Backend's /auth/send-otp (auth-service, app/api/v1/auth.py) reads body
// keys "phone" / "phone_number" / "email" — it never reads "identifier".
// LoginScreen already detects phone-vs-email by checking for '@', so this
// just needs to forward that under the right key.
function identifierToOtpBody(identifier) {
    return identifier && identifier.includes('@')
        ? { email: identifier }
        : { phone: identifier };
}

export const authService = {
    /**
     * Standard Login (OAuth2 form data format for FastAPI)
     */
    login: async (username, password) => {
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);
        return apiClient.post('/auth/login', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    },

    /**
     * Verify Token Check
     * FIXED: auth-service has no /auth/me route — the only "whoami" lives
     * on healthcare-core at /healthcare/auth/me. (Currently unused by any
     * page, but left correct rather than silently 404ing if wired up later.)
     */
    verifyToken: async () => {
        return apiClient.get('/healthcare/auth/me');
    },

    /**
     * Request a password reset OTP.
     * FIXED: backend's ForgotPasswordRequest schema requires the field name
     * "identifier" (it accepts either an email or a phone number) — this
     * was sending "email", which 422'd on every request regardless of what
     * the user typed in the "Hospain ID or Email" field.
     */
    requestPasswordReset: async (identifier) => {
        return apiClient.post('/auth/forgot-password/request', { identifier });
    },

    /**
     * Send OTP for Login.
     * FIXED: was posting { identifier, method } — backend never reads
     * "identifier" and always 422'd with "phone or email is required".
     * Now sends { phone } or { email } depending on what was typed.
     */
    sendOTP: async (identifier, method) => {
        return apiClient.post('/auth/send-otp', identifierToOtpBody(identifier));
    },

    /**
     * Verify OTP for password reset.
     * FIXED: same field-name issue as requestPasswordReset — backend's
     * VerifyOTPRequest schema requires "identifier", not "email".
     */
    verifyPasswordResetOTP: async (identifier, otp) => {
        return apiClient.post('/auth/forgot-password/verify', { identifier, otp });
    },

    /**
     * Verify OTP for sign-in (Access Token tab).
     * BUG FIX: LoginScreen's OTP flow used to call login() for both password
     * and OTP modes, sending the 6-digit code as if it were the account
     * password to /auth/login — that endpoint checks it against the stored
     * password hash, so it always returned 401, no matter how many times
     * the user re-typed a perfectly valid code. The backend's actual
     * OTP-login route is /auth/verify-otp, which checks the code against
     * the OTPVerification record sent by sendOTP, not the password hash.
     */
    verifyOTP: async (identifier, otp) => {
        return apiClient.post('/auth/verify-otp', { ...identifierToOtpBody(identifier), otp });
    },

    /**
     * Reset Password
     */
    resetPassword: async (resetToken, newPassword) => {
        return apiClient.post('/auth/forgot-password/reset', { reset_token: resetToken, new_password: newPassword });
    }
};
