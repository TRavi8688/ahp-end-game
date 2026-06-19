import apiClient from './apiClient';

export const billingService = {
  /**
   * GET /api/v1/billing/invoices
   * Returns list of all patient invoices (paid + pending).
   */
  getInvoices: async (signal) => {
    const response = await apiClient.get('/api/v1/billing/invoices', { signal });
    return response.data;
  },

  /**
   * GET /api/v1/billing/invoices/:invoiceId
   * Returns full invoice with line items for InvoiceDetailScreen.
   */
  getInvoiceDetail: async (invoiceId, signal) => {
    const response = await apiClient.get(`/api/v1/billing/invoices/${invoiceId}`, { signal });
    return response.data;
  },

  /**
   * POST /api/v1/billing/payments/:invoiceId
   * Initiates a payment. method = 'UPI' | 'CARD' | 'CASH'
   * Returns { payment_id, status, upi_deep_link? }
   */
  payInvoice: async (invoiceId, amount, method = 'UPI') => {
    const response = await apiClient.post(`/api/v1/billing/payments/${invoiceId}`, {
      amount,
      payment_method: method,
    });
    return response.data;
  },

  /**
   * GET /api/v1/billing/payments/:invoiceId/status
   * Poll payment status after UPI redirect.
   */
  getPaymentStatus: async (invoiceId, signal) => {
    const response = await apiClient.get(`/api/v1/billing/payments/${invoiceId}/status`, { signal });
    return response.data;
  },

  /**
   * GET /api/v1/billing/ledger
   * Returns full billing ledger for the patient (used in WeeklyTrends / HomeScreen charts).
   */
  getLedger: async (signal) => {
    const response = await apiClient.get('/api/v1/billing/ledger', { signal });
    return response.data;
  },
};
