import apiClient from './apiClient';

// NOTE on response shapes:
// apiClient's response interceptor already unwraps axios's `response.data`
// for you (see apiClient.js). Endpoints on the backend that use
// success_response() return { success, message, data } -- for those,
// reach into `.data` yourself in the component, exactly like the
// pre-existing getStats/getAlerts/getAccessHistory calls already expect.
// Endpoints that return a plain object/array (profile, schedule, analytics,
// my-patients, leave, roster, holidays, breaks/today) come back directly,
// no extra unwrapping needed.

export const doctorService = {
    /**
     * Fetch the doctor's own profile
     */
    getProfile: async () => {
        return apiClient.get('/doctor/profile/me');
    },

    /**
     * Update doctor profile (name, specialty)
     */
    updateProfile: async (payload) => {
        return apiClient.put('/doctor/profile', payload);
    },

    /**
     * Update doctor settings (notifications, session timeout)
     */
    updateSettings: async (payload) => {
        return apiClient.put('/doctor/settings', payload);
    },

    /**
     * Fetch dashboard statistics for the doctor
     */
    getStats: async () => {
        return apiClient.get('/doctor/stats');
    },

    /**
     * Fetch alerts/notifications - fixed from /clinical/alerts to /doctor/alerts
     */
    getAlerts: async () => {
        return apiClient.get('/doctor/alerts');
    },

    /**
     * Fetch security access history - fixed from /profile/access-history to /doctor/access-history
     */
    getAccessHistory: async () => {
        return apiClient.get('/doctor/access-history');
    },

    /**
     * Weekly schedule grid (MON-FRI), optional week_start=YYYY-MM-DD
     */
    getSchedule: async (weekStart) => {
        const query = weekStart ? `?week_start=${weekStart}` : '';
        return apiClient.get(`/doctor/schedule${query}`);
    },

    /**
     * Provision a new appointment slot for a patient by Hospyn ID
     */
    provisionSlot: async (payload) => {
        return apiClient.post('/doctor/schedule/provision', payload);
    },

    /**
     * Analytics dashboard data -- replaces mock data entirely
     */
    getAnalytics: async () => {
        return apiClient.get('/doctor/analytics');
    },

    /**
     * All patients this doctor has seen
     */
    getMyPatients: async () => {
        return apiClient.get('/doctor/my-patients');
    },

    /**
     * Earnings summary. period: 'week' | 'month' | 'year'
     */
    getEarnings: async (period = 'month') => {
        return apiClient.get(`/doctor/earnings?period=${period}`);
    },

    // -- Leave management ---------------------------------------------------
    getLeaveHistory: async () => {
        return apiClient.get('/doctor/leave');
    },
    requestLeave: async (payload) => {
        // payload: { leave_type, start_date, end_date, reason }
        return apiClient.post('/doctor/leave', payload);
    },
    cancelLeave: async (leaveId) => {
        return apiClient.delete(`/doctor/leave/${leaveId}`);
    },

    // -- Break system (typed breaks + queue auto-pause) ---------------------
    startBreak: async (payload) => {
        // payload: { break_type, expected_duration_minutes, note }
        return apiClient.post('/doctor/session/break/start', payload);
    },
    endBreak: async () => {
        return apiClient.post('/doctor/session/break/end');
    },
    getTodayBreaks: async () => {
        return apiClient.get('/doctor/breaks/today');
    },

    // -- Roster ---------------------------------------------------------------
    getRoster: async (year, month) => {
        return apiClient.get(`/doctor/roster?year=${year}&month=${month}`);
    },
    setRosterShift: async (payload) => {
        // payload: { shift_date, shift_type, start_time, end_time, notes }
        return apiClient.put('/doctor/roster', payload);
    },
    deleteRosterShift: async (shiftDate) => {
        return apiClient.delete(`/doctor/roster/${shiftDate}`);
    },

    // -- Holidays ---------------------------------------------------------------
    getHolidays: async (year) => {
        return apiClient.get(`/doctor/holidays?year=${year}`);
    },
    createHoliday: async (payload) => {
        // payload: { holiday_date, name, is_full_day }
        return apiClient.post('/doctor/holidays', payload);
    },

    // -- Notifications ------------------------------------------------------
    getNotifications: async () => {
        return apiClient.get('/doctor/notifications');
    },
    markNotificationRead: async (notificationId) => {
        return apiClient.patch(`/doctor/notifications/${notificationId}/read`);
    },
    markAllNotificationsRead: async () => {
        return apiClient.post('/doctor/notifications/read-all');
    },

    // -- Phone number change via OTP -----------------------------------------
    sendPhoneOtp: async (phoneNumber) => {
        return apiClient.post('/doctor/send-phone-otp', { phone_number: phoneNumber });
    },
    verifyPhoneOtp: async (phoneNumber, otp) => {
        return apiClient.post('/doctor/verify-phone-otp', { phone_number: phoneNumber, otp });
    },

    // -- Availability -----------------------------------------------------------
    getAvailability: async () => {
        return apiClient.get('/doctor/availability');
    },
    setAvailability: async (slots) => {
        return apiClient.put('/doctor/availability', { slots });
    },
};
