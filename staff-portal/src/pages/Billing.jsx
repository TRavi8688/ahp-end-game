import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import apiClient from "../apiClient";

// ─── Print styles (injected into <head> once) ─────────────────────────────────
const PRINT_STYLE = `
@media print {
  body > *:not(#receipt-print-root) { display: none !important; }
  #receipt-print-root {
    display: block !important;
    position: fixed;
    inset: 0;
    background: white;
    z-index: 9999;
    padding: 32px;
    font-family: sans-serif;
  }
  #receipt-print-root .no-print { display: none !important; }
}
`;

function injectPrintStyles() {
  if (document.getElementById("ahp-print-styles")) return;
  const style = document.createElement("style");
  style.id = "ahp-print-styles";
  style.textContent = PRINT_STYLE;
  document.head.appendChild(style);
}

// ─── Receipt Modal ─────────────────────────────────────────────────────────────
function ReceiptModal({ record, onClose }) {
  const hospitalName =
    localStorage.getItem("hospital_name") || "City Care Hospital";
  const hospitalAddress =
    localStorage.getItem("hospital_address") || "123 Main Street, City";

  const subtotal = record.items?.reduce(
    (sum, item) => sum + item.amount * (item.qty || 1),
    0
  ) || record.amount || 0;
  const gst = record.gst_applicable
    ? parseFloat((subtotal * 0.18).toFixed(2))
    : 0;
  const total = subtotal + gst;

  const handlePrint = () => window.print();

  const handlePDF = () => {
    const doc = new jsPDF();

    // Hospital header
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175); // blue-700
    doc.text(hospitalName, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(hospitalAddress, 14, 27);
    doc.line(14, 31, 196, 31);

    // Receipt title
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("BILLING RECEIPT", 14, 40);

    // Patient info
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Patient: ${record.patient_name || "—"}`, 14, 50);
    doc.text(`Patient ID: ${record.patient_id || "—"}`, 14, 57);
    doc.text(
      `Date: ${record.date ? new Date(record.date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}`,
      14, 64
    );
    doc.text(`Receipt No: ${record.id || "—"}`, 14, 71);
    doc.text(`Payment: ${record.payment_method || "Cash"}`, 14, 78);

    // Items table
    const rows = (record.items || [{ description: record.description || "Consultation", amount: record.amount, qty: 1 }]).map(
      (item) => [
        item.description,
        item.qty || 1,
        `₹${item.amount?.toFixed(2) || "0.00"}`,
        `₹${((item.amount || 0) * (item.qty || 1)).toFixed(2)}`,
      ]
    );

    autoTable(doc, {
      startY: 85,
      head: [["Description", "Qty", "Unit Price", "Amount"]],
      body: rows,
      theme: "striped",
      headStyles: { fillColor: [30, 64, 175] },
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, 140, finalY);
    if (gst > 0) doc.text(`GST (18%): ₹${gst.toFixed(2)}`, 140, finalY + 7);
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(`Total: ₹${total.toFixed(2)}`, 140, finalY + (gst > 0 ? 16 : 9));

    // PAID stamp
    if (record.status === "paid") {
      doc.setFontSize(36);
      doc.setTextColor(22, 163, 74); // green-600
      doc.setFont(undefined, "bold");
      doc.setGState(new doc.GState({ opacity: 0.25 }));
      doc.text("PAID", 60, 160, { angle: 30 });
    }

    doc.save(`receipt-${record.id || "bill"}.pdf`);
  };

  return (
    <>
      {/* Print-only root */}
      <div id="receipt-print-root" style={{ display: "none" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h2 style={{ color: "#1e40af", fontSize: 22, margin: 0 }}>{hospitalName}</h2>
          <p style={{ color: "#666", fontSize: 13, margin: "4px 0 0" }}>{hospitalAddress}</p>
          <hr style={{ margin: "12px 0" }} />
        </div>
        <h3 style={{ textAlign: "center", letterSpacing: 2 }}>BILLING RECEIPT</h3>
        <table style={{ width: "100%", fontSize: 13, marginBottom: 12 }}>
          <tbody>
            <tr><td><b>Patient:</b> {record.patient_name}</td><td><b>Receipt No:</b> {record.id}</td></tr>
            <tr><td><b>Patient ID:</b> {record.patient_id}</td><td><b>Date:</b> {record.date ? new Date(record.date).toLocaleDateString("en-IN") : "—"}</td></tr>
            <tr><td><b>Payment:</b> {record.payment_method || "Cash"}</td></tr>
          </tbody>
        </table>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1e40af", color: "white" }}>
              <th style={{ padding: "6px 8px", textAlign: "left" }}>Description</th>
              <th style={{ padding: "6px 8px" }}>Qty</th>
              <th style={{ padding: "6px 8px" }}>Unit Price</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(record.items || [{ description: record.description || "Consultation", amount: record.amount, qty: 1 }]).map((item, i) => (
              <tr key={i} style={{ background: i % 2 ? "#f3f4f6" : "white" }}>
                <td style={{ padding: "5px 8px" }}>{item.description}</td>
                <td style={{ padding: "5px 8px", textAlign: "center" }}>{item.qty || 1}</td>
                <td style={{ padding: "5px 8px", textAlign: "center" }}>₹{item.amount?.toFixed(2)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right" }}>₹{((item.amount || 0) * (item.qty || 1)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "right", marginTop: 12, fontSize: 13 }}>
          <p>Subtotal: ₹{subtotal.toFixed(2)}</p>
          {gst > 0 && <p>GST (18%): ₹{gst.toFixed(2)}</p>}
          <p style={{ fontWeight: "bold", fontSize: 16 }}>Total: ₹{total.toFixed(2)}</p>
        </div>
        {record.status === "paid" && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <span style={{ fontSize: 36, color: "#16a34a", opacity: 0.4, fontWeight: "bold", transform: "rotate(-20deg)", display: "inline-block" }}>
              ✓ PAID
            </span>
          </div>
        )}
      </div>

      {/* Modal overlay */}
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between bg-blue-700 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-white">{hospitalName}</h2>
              <p className="text-xs text-blue-200">{hospitalAddress}</p>
            </div>
            <button onClick={onClose} className="no-print text-white text-2xl font-bold hover:text-blue-200">×</button>
          </div>

          <div className="p-6">
            <div className="flex justify-between mb-1">
              <span className="font-bold text-gray-700 text-lg">BILLING RECEIPT</span>
              {record.status === "paid" && (
                <span className="text-green-600 font-bold text-lg opacity-60 rotate-[-15deg] inline-block">✓ PAID</span>
              )}
            </div>
            <hr className="mb-4" />

            <div className="grid grid-cols-2 gap-1 text-sm text-gray-600 mb-4">
              <span><b>Patient:</b> {record.patient_name || "—"}</span>
              <span><b>Receipt #:</b> {record.id || "—"}</span>
              <span><b>Patient ID:</b> {record.patient_id || "—"}</span>
              <span><b>Date:</b> {record.date ? new Date(record.date).toLocaleDateString("en-IN") : "—"}</span>
              <span><b>Payment:</b> {record.payment_method || "Cash"}</span>
            </div>

            <table className="w-full text-sm mb-4">
              <thead className="bg-blue-700 text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-center">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(record.items || [{ description: record.description || "Consultation", amount: record.amount, qty: 1 }]).map((item, i) => (
                  <tr key={i} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-center">{item.qty || 1}</td>
                    <td className="px-3 py-2 text-right">₹{item.amount?.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">₹{((item.amount || 0) * (item.qty || 1)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-right text-sm space-y-1">
              <p>Subtotal: ₹{subtotal.toFixed(2)}</p>
              {gst > 0 && <p>GST (18%): ₹{gst.toFixed(2)}</p>}
              <p className="text-lg font-bold text-gray-900">Total: ₹{total.toFixed(2)}</p>
            </div>
          </div>

          <div className="no-print flex gap-3 border-t border-gray-100 px-6 py-4">
            <button
              onClick={handlePrint}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              🖨️ Print
            </button>
            <button
              onClick={handlePDF}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              📄 Export PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Billing main page ─────────────────────────────────────────────────────────
export default function Billing() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    injectPrintStyles();
    const hospitalId =
      localStorage.getItem("hospital_id") ||
      sessionStorage.getItem("hospital_id") ||
      "1";
    apiClient
      .get(`/api/v1/billing?hospital_id=${hospitalId}`)
      .then((res) => setRecords(res.data?.bills || res.data || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = records.filter(
    (r) =>
      !search ||
      r.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      String(r.patient_id).includes(search) ||
      String(r.id).includes(search)
  );

  const statusBadge = (status) => {
    const map = {
      paid: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      overdue: "bg-red-100 text-red-800",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || "bg-gray-100 text-gray-700"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by patient name, ID, receipt #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Receipt #</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No billing records found
                  </td>
                </tr>
              )}
              {filtered.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">#{record.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{record.patient_name}</p>
                    <p className="text-xs text-gray-400">ID: {record.patient_id}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {record.date
                      ? new Date(record.date).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    ₹{(record.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">
                    {record.payment_method || "—"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(record.status)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      🖨️ Print Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRecord && (
        <ReceiptModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}
