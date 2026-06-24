// patient-app/src/services/ticketService.js
//
// NEW (2026-06-23): the "Hospyn Help Center" button in Settings used to just
// show a fake local alert — it never called the backend at all, even though
// healthcare-core already has a full ticket system (create / list / message).
// This service wires the patient app up to the real thing.
//
// Identity note: most patient-app users register by phone, not email, so we
// send whichever identifier the user actually has (SecurityUtils stores the
// identifier they logged in with under "hospyn_id") as either
// X-Owner-Email or X-Owner-Phone. The backend's /tickets/my-tickets was
// extended (see backend FIX-T1) to accept either.

import apiClient from './apiClient';
import { SecurityUtils } from '../utils/security';

const ownerHeaders = async () => {
    const identifier = await SecurityUtils.getHospynId();
    if (!identifier) return {};
    return identifier.includes('@')
        ? { 'X-Owner-Email': identifier }
        : { 'X-Owner-Phone': identifier };
};

export const ticketService = {
    /**
     * category must be one of: billing | technical | onboarding | staff_access | data | other
     */
    createTicket: async ({ category = 'other', priority = 'medium', subject, description, ownerEmail, ownerPhone }) => {
        const headers = await ownerHeaders();
        const response = await apiClient.post('/tickets/create', {
            category,
            priority,
            product: 'patient_app',
            subject,
            description,
            owner_email: ownerEmail,
            owner_phone: ownerPhone,
        }, { headers });
        return response.data; // { ticket_id, status, team, sla_hours, message }
    },

    getMyTickets: async () => {
        const headers = await ownerHeaders();
        const response = await apiClient.get('/tickets/my-tickets', { headers });
        return response.data; // { tickets, total }
    },
};

export default ticketService;
