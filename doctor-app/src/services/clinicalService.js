import apiClient from './apiClient';

export const clinicalService = {
    /**
     * Fetch all patients assigned to the doctor
     * Uses the correct /doctor/my-patients endpoint
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
     * Fetch a specific patient's comprehensive details by Hospyn ID
     * Uses the correct /doctor/patient/{hospynId} endpoint
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
     * Complete consultation and issue a prescription
     */
    createPrescription: async (walkinId, consultationData) => {
        return apiClient.patch(`/doctor/queue/${walkinId}/complete`, consultationData);
    },

    /**
     * Check drug interaction for a specific patient
     * Uses the correct /doctor/patient/{patientId}/check-drug endpoint
     */
    checkDrugInteraction: async (patientId, medicationName) => {
        return apiClient.get(`/doctor/patient/${patientId}/check-drug`, {
            params: { medication: medicationName }
        });
    },

    /**
     * Upload Medical Report
     */
    uploadMedicalReport: async (hospynId, file) => {
        const formData = new FormData();
        formData.append('file', file);

        return apiClient.post(`/clinical/patients/${hospynId}/upload-report`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    }
};
