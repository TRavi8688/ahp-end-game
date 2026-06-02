import apiClient from './apiClient';

export const clinicalService = {
    /**
     * Fetch all patients assigned to the doctor
     */
    getMyPatients: async (signal) => {
        return apiClient.get('/doctor/my-patients', { signal });
    },

    /**
     * Fetch live active queue of patients
     */
    getActiveQueue: async (signal) => {
        return apiClient.get('/doctor/queue', { signal });
    },

    /**
     * Start the doctor's queue session for the day
     */
    startQueueSession: async () => {
        return apiClient.post('/queue/session/start', {});
    },

    /**
     * Call the next patient in queue
     */
    callNextPatient: async () => {
        return apiClient.post('/queue/token/advance', {});
    },

    /**
     * Fetch a specific patient's comprehensive details
     */
    getPatientDetails: async (hospynId, signal) => {
        return apiClient.get(`/doctor/patient/${hospynId}`, { signal });
    },

    /**
     * Fetch clinical intake (vitals, chief complaint) for a patient
     */
    getPatientIntake: async (hospynId) => {
        return apiClient.get(`/doctor/patient/${hospynId}/intake`);
    },

    /**
     * Save consultation notes for a patient — POST /consultations
     */
    saveConsultationNotes: async (patientId, notes, diagnosis) => {
        return apiClient.post('/consultations', {
            patient_id: patientId,
            notes,
            diagnosis: diagnosis || '',
        });
    },

    /**
     * Create a prescription — POST /prescriptions
     */
    createPrescription: async (patientId, consultationData) => {
        return apiClient.post('/prescriptions', {
            patient_id: patientId,
            ...consultationData,
        });
    },

    /**
     * Order a lab test — POST /lab-orders
     */
    orderLabTest: async (patientId, testName, notes) => {
        return apiClient.post('/lab-orders', {
            patient_id: patientId,
            test_name: testName,
            notes: notes || '',
        });
    },

    /**
     * Mark consultation as done — advances the queue token
     */
    endConsultation: async (tokenId) => {
        return apiClient.post(`/queue/token/${tokenId}/complete`, {});
    },

    /**
     * Check drug interaction for a specific patient
     */
    checkDrugInteraction: async (patientId, medicationName) => {
        return apiClient.get(`/doctor/patient/${patientId}/check-drug`, {
            params: { medication: medicationName }
        });
    },

    /**
     * Search medicines from drug database
     */
    searchMedicines: async (query) => {
        return apiClient.get('/medicines/search', { params: { q: query } });
    },

    /**
     * Upload Medical Report
     */
    uploadMedicalReport: async (hospynId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiClient.post(`/doctor/patient/${hospynId}/upload-report`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    /**
     * Get doctor's earnings summary
     */
    getEarnings: async (period = 'month') => {
        return apiClient.get('/doctor/earnings', { params: { period } });
    },

    /**
     * Get doctor's availability slots
     */
    getAvailability: async () => {
        return apiClient.get('/doctor/availability');
    },

    /**
     * Set doctor's availability
     */
    setAvailability: async (slots) => {
        return apiClient.put('/doctor/availability', { slots });
    },

    /**
     * Mark a day off / leave
     */
    markLeave: async (leaveData) => {
        return apiClient.post('/doctor/leave', leaveData);
    },

    /**
     * Get all leave records
     */
    getLeaveHistory: async () => {
        return apiClient.get('/doctor/leave');
    },

    /**
     * Cancel a leave
     */
    cancelLeave: async (leaveId) => {
        return apiClient.delete(`/doctor/leave/${leaveId}`);
    },

    /**
     * Get notifications
     */
    getNotifications: async () => {
        return apiClient.get('/doctor/notifications');
    },

    /**
     * Mark notification as read
     */
    markNotificationRead: async (notificationId) => {
        return apiClient.patch(`/doctor/notifications/${notificationId}/read`, {});
    },

    /**
     * Mark all notifications as read
     */
    markAllNotificationsRead: async () => {
        return apiClient.post('/doctor/notifications/read-all', {});
    },
};
