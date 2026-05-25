import apiClient from './apiClient';

export const clinicalService = {
    /**
     * Fetch all patients assigned to the doctor
     * Uses AbortSignal for request cancellation on unmount
     */
    getMyPatients: async (signal) => {
        // Was /doctor/my-patients -> mapped to /clinical/patients (if scoped to user in backend)
        return apiClient.get('/clinical/patients', { signal });
    },

    /**
     * Fetch live active queue of patients
     */
    getActiveQueue: async (signal) => {
        return apiClient.get('/queue/active', { signal });
    },

    /**
     * Fetch a specific patient's comprehensive details
     */
    getPatientDetails: async (patientId, signal) => {
        return apiClient.get(`/clinical/patients/${patientId}`, { signal });
    },

    /**
     * Fetch clinical intake (vitals, chief complaint) for a patient
     */
    getPatientIntake: async (patientId) => {
        return apiClient.get(`/clinical/patients/${patientId}/intake`);
    },

    /**
     * Issue a prescription
     */
    createPrescription: async (prescriptionData) => {
        return apiClient.post('/clinical/prescriptions', prescriptionData);
    },

    /**
     * Check drug interaction
     */
    checkDrugInteraction: async (patientId, medicationName) => {
        return apiClient.get(`/clinical/patients/${patientId}/check-drug`, {
            params: { medication: medicationName }
        });
    },

    /**
     * Upload Medical Report
     */
    uploadMedicalReport: async (hospynId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // This explicitly overrides Content-Type to multipart/form-data
        return apiClient.post(`/clinical/patients/${hospynId}/upload-report`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    }
};
