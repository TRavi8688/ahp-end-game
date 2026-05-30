import apiClient from './apiClient';

export const billingService = {
    getInvoices: async (signal) => {
        const response = await apiClient.get('/billing/invoices', { signal });
        return response.data;
    },

    getInvoiceDetail: async (invoiceId, signal) => {
        const response = await apiClient.get(`/billing/invoices/${invoiceId}`, { signal });
        return response.data;
    },

    payInvoice: async (invoiceId, amount, method = 'UPI') => {
        const response = await apiClient.post(`/billing/payments/${invoiceId}`, {
            amount: amount,
            payment_method: method
        });
        return response.data;
    }
};
