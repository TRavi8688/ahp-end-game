import apiClient from './apiClient';

/**
 * BUG FIXES (this whole file was calling endpoints that don't exist):
 *   - getInvoices() called /billing/invoices — the real endpoint needs the
 *     patient's own id: GET /billing/patient/{patient_id}/invoices.
 *   - getInvoiceDetail() called /billing/invoices/{id} (plural) — the real
 *     endpoint is singular: GET /billing/invoice/{id}.
 *   - payInvoice() POSTed amount+method to /billing/payments/{id}, which
 *     never existed. Even if it had, letting the client directly tell the
 *     server "mark this paid" with no actual payment happening would be a
 *     real money/security bug. The backend only supports generating a UPI
 *     deep link/QR (GET /billing/invoice/{id}/upi-url) that opens the
 *     patient's own UPI app (GPay/PhonePe/etc) to pay the hospital directly;
 *     the hospital reconciles and marks it paid on their side. Replaced
 *     payInvoice() with getUpiPaymentLink() to match what the backend (and
 *     the real, working BillingDetailScreen) actually does.
 */
export const billingService = {
    getInvoices: async (patientId, signal) => {
        const response = await apiClient.get(`/billing/patient/${patientId}/invoices`, { signal });
        return response.data;
    },

    getInvoiceDetail: async (invoiceId, signal) => {
        const response = await apiClient.get(`/billing/invoice/${invoiceId}`, { signal });
        return response.data;
    },

    getUpiPaymentLink: async (invoiceId) => {
        const response = await apiClient.get(`/billing/invoice/${invoiceId}/upi-url`);
        return response.data?.data || response.data;
    },
};
