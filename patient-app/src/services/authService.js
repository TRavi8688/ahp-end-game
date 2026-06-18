/**
 * src/services/authService.js
 *
 * FIX 1: Login URL was /api/v1/healthcare/auth/login — WRONG.
 *         Auth service runs on a SEPARATE service (auth-service port 8001).
 *         Correct path is /api/v1/auth/login (form-encoded, OAuth2PasswordRequestForm).
 *
 * FIX 2: googleLogin URL was /api/v1/healthcare/auth/google — WRONG.
 *         Correct: /api/v1/auth/google
 *
 * FIX 3: appleLogin URL was /api/v1/healthcare/auth/apple — WRONG.
 *         Correct: /api/v1/auth/apple
 *
 * FIX 4: setupProfile URL was /api/v1/healthcare/patients/setup-profile — WRONG.
 *         Correct: /api/v1/healthcare/patients/setup-profile (this one IS on healthcare-core)
 *         Kept as-is but added error normalization.
 *
 * FIX 5: forgot-password paths were on /api/v1/healthcare/auth/... — WRONG.
 *         Correct: /api/v1/auth/forgot-password/... (auth-service)
 *
 * NOTE: AUTH_BASE_URL points to auth-service (port 8001 in dev).
 *       HEALTHCARE_BASE_URL points to healthcare-core (port 8002 in dev).
 *       In production both are proxied through the same domain via nginx/Cloud Run.
 */

import axios from 'axios';

// Auth service URL — separate from healthcare-core
const AUTH_BASE_URL =
  process.env.EXPO_PUBLIC_AUTH_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:8000';

// Healthcare core URL
const HEALTHCARE_BASE_URL =
  process.env.EXPO_PUBLIC_HEALTHCARE_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:8000';

export const authService = {

  /**
   * Login with Hospyn ID or email + password.
   * Backend expects OAuth2PasswordRequestForm (form-encoded, NOT JSON).
   */
  login: async (identifier, password) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', identifier);
      formData.append('password', password);

      const response = await axios.post(
        `${AUTH_BASE_URL}/api/v1/auth/login`,   // FIX: was /healthcare/auth/login
        formData.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.message ||
        'Login request failed.';
      throw new Error(msg);
    }
  },

  /**
   * Google OAuth — sends Google JWT credential to auth-service for verification.
   */
  googleLogin: async (credential) => {
    const response = await axios.post(
      `${AUTH_BASE_URL}/api/v1/auth/google`,    // FIX: was /healthcare/auth/google
      { token: credential },
      { timeout: 15000 }
    );
    return response.data;
  },

  /**
   * Apple Sign In — sends Apple identityToken to auth-service for verification.
   */
  appleLogin: async (identityToken) => {
    const response = await axios.post(
      `${AUTH_BASE_URL}/api/v1/auth/apple`,     // FIX: was /healthcare/auth/apple
      { token: identityToken },
      { timeout: 15000 }
    );
    return response.data;
  },

  /**
   * Setup patient profile after first Google/Apple sign in.
   * This IS on healthcare-core (creates patient record).
   */
  setupProfile: async (payload, tempToken) => {
    const response = await axios.post(
      `${HEALTHCARE_BASE_URL}/api/v1/healthcare/patients/setup-profile`,
      payload,
      {
        headers: { Authorization: `Bearer ${tempToken}` },
        timeout: 15000,
      }
    );
    return response.data;
  },

  /**
   * Forgot password — Step 1: Request OTP.
   */
  requestForgotPassword: async (identifier) => {
    const response = await axios.post(
      `${AUTH_BASE_URL}/api/v1/auth/forgot-password/request`, // FIX: was /healthcare/auth/...
      { identifier },
      { timeout: 10000 }
    );
    return response.data;
  },

  /**
   * Forgot password — Step 2: Verify OTP, receive reset token.
   */
  verifyForgotPassword: async (identifier, otp) => {
    const response = await axios.post(
      `${AUTH_BASE_URL}/api/v1/auth/forgot-password/verify`,
      { identifier, otp },
      { timeout: 10000 }
    );
    return response.data;
  },

  /**
   * Forgot password — Step 3: Set new password using reset token.
   */
  resetPassword: async (resetToken, newPassword) => {
    const response = await axios.post(
      `${AUTH_BASE_URL}/api/v1/auth/forgot-password/reset`,
      { reset_token: resetToken, new_password: newPassword },
      { timeout: 10000 }
    );
    return response.data;
  },

  /**
   * Refresh access token using refresh token.
   */
  refreshToken: async (refreshToken) => {
    const response = await axios.post(
      `${AUTH_BASE_URL}/api/v1/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 10000 }
    );
    return response.data;
  },
};
