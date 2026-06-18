import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import apiClient from "../services/apiClient";
import useAuthStore from "../store/authStore";

const PF_RATE = 0.12;
const ESI_RATE = 0.0075;

function calcPayroll(staff, attendanceDays, workingDays = 26) {
  const basic = staff.basic_salary || 0;
  const perDay = basic / workingDays;
  const earned = Math.round(perDay * attendanceDays);
  const pf = Math.round(earned * PF_RATE);
  const esi = Math.round(earned * ESI_RATE);
  const net = earned - pf - esi;
  return { basic, earned, pf, esi, net, attendanceDays };
}

// ─── Payslip Modal ────────────────────────────────────────────────────────────
function PayslipModal({ staff, month, year, onClose }) {
  const hospitalName = localStorage.getItem("hospital_name") || "City Care Hospital";
  const hospitalAddress = localStorage.getItem("hospital_address") || "123 Main Street";
  const { basic, earned, pf, esi, net, attendanceDays } = calcPayroll(staff, staff._attendance || 26);

  const handlePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175);
    doc.text(hospitalName, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(hospitalAddress, 14, 27);
    doc.line(14, 31, 196, 31);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("PAYSLIP", 14, 40);
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`Month: ${month} ${year}`, 14, 48);
    doc.text(`Employee: ${staff.name}`, 14, 55);
    doc.text(`Role: ${staff.role?.replace("_", " ")}`, 14, 62);
    doc.text(`Attendance: ${attendanceDays} days`, 14, 69);

    autoTable(doc, {
      startY: 76,
      head: [["Component", "Amount (₹)"]],
      body: [
        ["Basic Salary", basic.toLocaleString("en-IN")],
        ["Earned Salary", earned.toLocaleString("en-IN")],
        ["PF Deduction (12%)", `-${pf.toLocaleString("en-IN")}`],
        ["ESI Deduction (0.75%)", `-${esi.toLocaleString("en-IN")}`],
      ],
      theme: "striped",
      headStyles: { fillColor: [30, 64, 175] },
    });

    const y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text(`Net Pay: ₹${net.toLocaleString("en-IN")}`, 140, y);

    doc.setFontSize(36);
    doc.setTextColor(22, 163, 74);
    doc.setFont(undefined, "bold");
    doc.setGState(new doc.GState({ opacity: 0.2 }));
    doc.text("PAID", 60, 160, { angle: 30 });

    doc.save(`payslip-${staff.name}-${month}-${year}.pdf`);
  };

  const Row = ({ label, value, highlight }) => (
    <div className={`flex justify-between py-2 border-b border-gray-100 text-sm ${highlight ? "font-bold text-gray-900 text-base" : "text-gray-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-blue-700 px-6 py-4">
          <h2 className="text-lg font-bold text-white">{hospitalName}</h2>
          <p className="text-xs text-blue-200">Payslip — {month} {year}</p>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <p className="font-semibold text-gray-900 text-lg">{staff.name}</p>
            <p className="text-sm text-gray-500 capitalize">{staff.role?.replace("_", " ")} · {staff.department || "—"}</p>
            <p className="text-sm text-gray-400">Attendance: {attendanceDays} / 26 days</p>
          </div>
          <Row label="Basic Salary" value={`₹${basic.toLocaleString("en-IN")}`} />
          <Row label="Earned Salary" value={`₹${earned.toLocaleString("en-IN")}`} />
          <Row label="PF Deduction (12%)" value={`-₹${pf.toLocaleString("en-IN")}`} />
          <Row label="ESI Deduction (0.75%)" value={`-₹${esi.toLocaleString("en-IN")}`} />
          <Row label="Net Pay" value={`₹${net.toLocaleString("en-IN")}`} highlight />
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Close
          </button>
          <button onClick={handlePDF} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            📄 Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PayrollView ──────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function PayrollView() {
  const hospitalId = useAuthStore((s) => s.hospitalId) || "1";
  const now = new Date();
  const [month, setMonth] = useState(MONTHS[now.getMonth()]);
  const [year, setYear] = useState(now.getFullYear());
  const [selected, setSelected] = useState(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", hospitalId],
    queryFn: () =>
      apiClient
        .get(`/api/v1/staff/hospital/${hospitalId}`)
        .then((r) => (r.data?.staff || r.data || []).filter((s) => s.status === "active")),
  });

  const exportCSV = () => {
    const rows = [
      ["Name", "Role", "Department", "Basic Salary", "Attendance", "PF", "ESI", "Net Pay"],
      ...staff.map((s) => {
        const { basic, pf, esi, net, attendanceDays } = calcPayroll(s, s._attendance || 26);
        return [s.name, s.role, s.department || "", basic, attendanceDays, pf, esi, net];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${month}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-xs text-gray-400 mt-0.5">View-only — salary processing is handled externally</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {MONTHS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[2023, 2024, 2025, 2026].map((y) => <option key={y}>{y}</option>)}
          </select>
          <button
            onClick={exportCSV}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-right">Basic Salary</th>
                <th className="px-4 py-3 text-center">Attendance</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net Pay</th>
                <th className="px-4 py-3 text-center">Payslip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No active staff</td>
                </tr>
              )}
              {staff.map((s) => {
                const attendance = s._attendance || 26;
                const { basic, pf, esi, net } = calcPayroll(s, attendance);
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{s.role?.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-right text-gray-700">₹{basic.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{attendance}/26</td>
                    <td className="px-4 py-3 text-right text-red-500">-₹{(pf + esi).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">₹{net.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelected(s)}
                        className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        View Payslip
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <PayslipModal
          staff={selected}
          month={month}
          year={year}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
