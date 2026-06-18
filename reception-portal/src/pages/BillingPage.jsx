import { useState, useEffect } from "react";
import receptionApi from "../services/receptionApi";
import InvoiceQRModal from "../components/InvoiceQRModal";

export default function BillingPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data } = await receptionApi.get("/billing/hospital/invoices");
      setInvoices(data.data || []);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    try {
      await receptionApi.patch(`/billing/invoice/${invoiceId}/mark-paid`, {
        payment_method: "CASH",
        upi_transaction_ref: "CASH-DESK"
      });
      fetchInvoices();
    } catch (err) {
      alert("Failed to mark paid");
    }
  };

  if (loading) return <div style={s.page}>Loading billing data...</div>;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>Patient Billing & Invoices</h1>
        <p style={s.subtitle}>Generate UPI QR Codes for patients to scan at the desk</p>
      </header>

      <div style={s.grid}>
        {invoices.length === 0 ? (
          <p>No invoices found.</p>
        ) : (
          invoices.map((inv) => (
            <div key={inv.id} style={s.card}>
              <div style={s.cardHeader}>
                <span style={s.invoiceNo}>{inv.invoice_number}</span>
                <span style={{
                  ...s.statusBadge,
                  backgroundColor: inv.status === 'PAID' ? '#dcfce7' : '#fee2e2',
                  color: inv.status === 'PAID' ? '#166534' : '#991b1b'
                }}>
                  {inv.status}
                </span>
              </div>
              <div style={s.cardBody}>
                <p><strong>Patient ID:</strong> {inv.patient_id?.substring(0, 8)}...</p>
                <p style={s.amount}>₹{inv.payable_amount.toLocaleString()}</p>
                <p style={s.date}>{new Date(inv.created_at).toLocaleDateString()}</p>
              </div>
              
              <div style={s.cardActions}>
                {inv.status !== 'PAID' ? (
                  <>
                    <button style={s.qrBtn} onClick={() => setSelectedInvoice(inv)}>
                      💳 Show UPI QR
                    </button>
                    <button style={s.cashBtn} onClick={() => handleMarkPaid(inv.id)}>
                      💵 Paid Cash
                    </button>
                  </>
                ) : (
                  <button style={s.printBtn} onClick={() => alert("Printing...")}>
                    🖨️ Print Receipt
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedInvoice && (
        <InvoiceQRModal 
          invoice={selectedInvoice} 
          onClose={() => {
            setSelectedInvoice(null);
            fetchInvoices();
          }} 
        />
      )}
    </div>
  );
}

const s = {
  page: { padding: 32 },
  header: { marginBottom: 32 },
  title: { fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 },
  subtitle: { color: "#6b7280", marginTop: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 },
  card: { background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  invoiceNo: { fontWeight: 600, color: "#374151" },
  statusBadge: { padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600 },
  cardBody: { marginBottom: 20 },
  amount: { fontSize: 28, fontWeight: 800, color: "#111827", margin: "8px 0" },
  date: { fontSize: 13, color: "#6b7280" },
  cardActions: { display: "flex", gap: 8, borderTop: "1px solid #f3f4f6", paddingTop: 16 },
  qrBtn: { flex: 1, padding: "8px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 },
  cashBtn: { flex: 1, padding: "8px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 },
  printBtn: { width: "100%", padding: "8px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }
};
