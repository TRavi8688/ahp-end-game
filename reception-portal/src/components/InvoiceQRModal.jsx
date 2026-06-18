import { useState, useEffect } from "react";
import receptionApi from "../services/receptionApi";

export default function InvoiceQRModal({ invoice, onClose }) {
  const [qrBase64, setQrBase64] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (invoice) {
      fetchQR();
    }
  }, [invoice]);

  const fetchQR = async () => {
    try {
      setLoading(true);
      setError(null);
      // Backend API: GET /billing/invoice/{invoice_id}/upi-qr
      const { data } = await receptionApi.get(`/billing/invoice/${invoice.id}/upi-qr`);
      setQrBase64(data.data.qr_base64);
    } catch (err) {
      console.error("Failed to fetch UPI QR:", err);
      setError(err.response?.data?.detail || "Failed to generate QR Code. Make sure the hospital has a UPI VPA configured.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    // In a real scenario, this might trigger a server-side check with the UPI gateway.
    // For now, we will just manually mark it as paid via the desk if the patient showed their screen.
    const ref = prompt("Enter UPI Transaction Reference (from patient's app):");
    if (!ref) return;

    try {
      await receptionApi.patch(`/billing/invoice/${invoice.id}/mark-paid`, {
        payment_method: "UPI",
        upi_transaction_ref: ref
      });
      alert("Payment verified and invoice marked as PAID!");
      onClose();
    } catch (err) {
      alert("Failed to update invoice status.");
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <h2 style={s.title}>Scan to Pay</h2>
          <button style={s.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div style={s.body}>
          <p style={s.amount}>₹{invoice.payable_amount.toLocaleString()}</p>
          <p style={s.subText}>Invoice: {invoice.invoice_number}</p>

          <div style={s.qrContainer}>
            {loading ? (
              <div style={s.loader}>Generating Secure UPI QR...</div>
            ) : error ? (
              <div style={s.error}>{error}</div>
            ) : (
              <>
                <img 
                  src={`data:image/png;base64,${qrBase64}`} 
                  alt="UPI QR Code" 
                  style={s.qrImage} 
                />
                <p style={s.scanText}>Scan with GPay, PhonePe, or Paytm</p>
              </>
            )}
          </div>
        </div>

        <div style={s.footer}>
          {!loading && !error && (
            <button style={s.verifyBtn} onClick={handleVerifyPayment}>
              Verify Payment Received
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)", display: "flex",
    justifyContent: "center", alignItems: "center", zIndex: 1000
  },
  modal: {
    background: "#fff", width: 400, borderRadius: 16, overflow: "hidden",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
  },
  header: {
    padding: "20px 24px", display: "flex", justifyContent: "space-between",
    alignItems: "center", borderBottom: "1px solid #f3f4f6"
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" },
  closeBtn: { background: "none", border: "none", fontSize: 24, color: "#6b7280", cursor: "pointer" },
  body: { padding: 32, textAlign: "center" },
  amount: { fontSize: 36, fontWeight: 800, color: "#1d4ed8", margin: 0 },
  subText: { fontSize: 14, color: "#6b7280", marginTop: 4, marginBottom: 24 },
  qrContainer: {
    background: "#f8fafc", padding: 24, borderRadius: 12,
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", minHeight: 250
  },
  qrImage: { width: 220, height: 220 },
  scanText: { marginTop: 16, fontSize: 13, color: "#475569", fontWeight: 500 },
  loader: { color: "#6366f1", fontWeight: 500 },
  error: { color: "#ef4444", padding: 16, background: "#fee2e2", borderRadius: 8, fontSize: 14 },
  footer: { padding: 20, background: "#f8fafc", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "center" },
  verifyBtn: {
    width: "100%", padding: "12px", background: "#10b981", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer"
  }
};
