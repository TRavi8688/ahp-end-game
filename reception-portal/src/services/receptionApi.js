// reception-portal/src/services/receptionApi.js
// SEC-7 FIX: Replace localStorage token with httpOnly cookie via credentials:'include'.
// SEC-10 FIX: Expiry check is also handled here (see SEC-10 file for details).

import axios from "axios";

const receptionApi = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,  // SEC-7: sends httpOnly cookie automatically
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// SEC-7: Removed localStorage.getItem("staff_token") — no longer needed.
// The browser sends the httpOnly cookie on every request automatically.

receptionApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default receptionApi;
