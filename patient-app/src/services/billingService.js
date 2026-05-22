import apiClient from './apiClient';

export const billingService = {
    getInvoices: async (signal) => {
        const response = await apiClient.get('/billing/invoices', { signal });
        return response.data;
    },

    getInvoiceDetail: async (invoiceId, signal) => {
        const response = await apiClient.get(`/billing/invoices/${invoiceId}`, { signal });
        return response.data;
    }
};
