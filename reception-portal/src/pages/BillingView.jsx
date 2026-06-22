/**
 * BillingView.jsx
 * Phase 3 Fix: Reception Portal — Billing view with Mark as Paid
 *
 * APPLY TO: reception-portal/src/pages/BillingView.jsx  (create new file)
 * REGISTER: Add route in reception-portal router: <Route path="/billing/:invoiceId" element={<BillingView />} />
 *
 * Install QR code library:
 *   npm install qrcode.react
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QRCode from "qrcode.react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function BillingView() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [upiUrl, setUpiUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [upiRef, setUpiRef] = useState("");
  const [marking, setMarking] = useState(false);
  const [success, setSuccess] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const id = invoiceId;
    if (!id) return;

    Promise.all([
      fetch(`${API_BASE}/api/v1/billing/invoice/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.ok ? r.json() : Promise.reject("Invoice not found")),
      fetch(`${API_BASE}/api/v1/billing/invoice/${id}/upi-url`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([inv, upi]) => {
        setInvoice(inv);
        setUpiUrl(upi?.upi_url || null);
        setLoading(false);
      })
      .catch((e) => {
        setError(typeof e === "string" ? e : "Failed to load billing data");
        setLoading(false);
      });
  }, [invoiceId]);

  const handleMarkPaid = async () => {
    if (!upiRef.trim()) {
      alert("Please enter the UPI transaction reference (from patient's GPay/PhonePe)");
      return;
    }
    setMarking(true);
    try {
      const r = await fetch(`${API_BASE}/api/v1/billing/invoice/${invoiceId}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ upi_transaction_ref: upiRef, paid_by: "reception" }),
      });
      if (!r.ok) throw new Error("Failed to mark as paid");
      setSuccess(true);
      setShowMarkPaid(false);
      // Reload invoice to show PAID status
      const updated = await fetch(`${API_BASE}/api/v1/billing/invoice/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      setInvoice(updated);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setMarking(false);
    }
  };

  const handleDownloadReceipt = () => {
    window.open(
      `${API_BASE}/api/v1/billing/invoice/${invoiceId}/receipt`,
      "_blank"
    );
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
      <p style={{ color: "#6b7280" }}>Loading invoice...</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>
      <p>⚠️ {error}</p>
    </div>
  );

  const isPaid = invoice?.status === "paid";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#374151" }}>
          ←
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
            Invoice #{invoice?.invoice_number}
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>{invoice?.hospital_name}</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span style={{
            background: isPaid ? "#d1fae5" : "#fef3c7",
            color: isPaid ? "#065f46" : "#92400e",
            borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700,
          }}>
            {isPaid ? "✓ PAID" : "PENDING"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Invoice details */}
        <div>
          <div style={card}>
            <h3 style={cardTitle}>Patient Details</h3>
            <p style={infoRow}><span style={label}>Patient</span>{invoice?.patient_name}</p>
            <p style={infoRow}><span style={label}>Phone</span>{invoice?.patient_phone}</p>
            <p style={infoRow}><span style={label}>Invoice No.</span>{invoice?.invoice_number}</p>
            <p style={infoRow}><span style={label}>Date</span>{String(invoice?.created_at || "").slice(0, 10)}</p>
          </div>

          <div style={{ ...card, marginTop: 16 }}>
            <h3 style={cardTitle}>Line Items</h3>
            {(invoice?.line_items || []).map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span>{item.description} × {item.quantity || 1}</span>
                <span>₹{((item.quantity || 1) * item.unit_price).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ borderTop: "2px solid #1e3a5f", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
              <span>TOTAL</span>
              <span>₹{parseFloat(invoice?.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>

          {isPaid && (
            <div style={{ ...card, marginTop: 16, background: "#d1fae5", border: "1px solid #a7f3d0" }}>
              <h3 style={{ ...cardTitle, color: "#065f46" }}>Payment Confirmed</h3>
              <p style={infoRow}><span style={label}>UPI Ref</span>{invoice?.upi_transaction_ref}</p>
              <p style={infoRow}><span style={label}>Paid At</span>{String(invoice?.paid_at || "").slice(0, 19).replace("T", " ")}</p>
              <button onClick={handleDownloadReceipt}
                style={{ ...btnPrimary, marginTop: 8, background: "#065f46" }}>
                ↓ Download Receipt PDF
              </button>
            </div>
          )}
        </div>

        {/* QR Code side */}
        <div>
          {!isPaid && upiUrl ? (
            <div style={{ ...card, textAlign: "center" }}>
              <h3 style={cardTitle}>Scan to Pay</h3>
              <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
                Patient scans with GPay / PhonePe / Paytm
              </p>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <QRCode value={upiUrl} size={200} level="H" />
              </div>
              <p style={{ fontWeight: 700, fontSize: 18, color: "#1e3a5f" }}>
                ₹{parseFloat(invoice?.total_amount || 0).toFixed(2)}
              </p>
              <p style={{ color: "#6b7280", fontSize: 12 }}>Pay to: {invoice?.upi_vpa}</p>
            </div>
          ) : !isPaid ? (
            <div style={{ ...card, textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <p style={{ fontSize: 13 }}>Hospital has not configured UPI VPA.<br />Ask admin to set it in Hospital Settings.</p>
            </div>
          ) : null}

          {!isPaid && (
            <div style={{ ...card, marginTop: 16 }}>
              <h3 style={cardTitle}>After Patient Pays</h3>
              <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
                Ask patient for the UPI transaction ID from their payment app, then confirm below.
              </p>
              <button onClick={() => setShowMarkPaid(true)} style={{ ...btnPrimary, width: "100%" }}>
                ✓ Mark as Paid
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mark Paid Modal */}
      {showMarkPaid && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div style={{ background: "white", borderRadius: 12, padding: 28, minWidth: 380 }}>
            <h2 style={{ marginTop: 0 }}>Confirm Payment</h2>
            <p style={{ color: "#6b7280", fontSize: 14 }}>
              Enter the UPI transaction ID from the patient's GPay / PhonePe / Paytm confirmation screen.
            </p>
            <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
              UPI Transaction Reference *
            </label>
            <input
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
              placeholder="e.g. GPay:3029182763812937 or 12-digit ID"
              value={upiRef}
              onChange={(e) => setUpiRef(e.target.value)}
            />
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              This is the reference shown in the patient's UPI app after payment.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={handleMarkPaid}
                disabled={marking}
                style={{ ...btnPrimary, opacity: marking ? 0.6 : 1 }}>
                {marking ? "Confirming..." : "✓ Confirm Payment"}
              </button>
              <button
                onClick={() => setShowMarkPaid(false)}
                style={{ background: "white", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const card = { background: "white", borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };
const cardTitle = { margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#374151" };
const infoRow = { display: "flex", justifyContent: "space-between", margin: "0 0 6px", fontSize: 13, color: "#374151" };
const label = { color: "#9ca3af", fontWeight: 500 };
const btnPrimary = { background: "#1e3a5f", color: "white", border: "none", borderRadius: 6, padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600 };
