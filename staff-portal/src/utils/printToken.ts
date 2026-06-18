/**
 * printToken
 * Opens a print-optimised window with the token slip.
 * Works without a thermal printer — regular browser print dialog.
 */
export const printToken = (token: {
  token_number: string | number;
  patient_name: string;
  doctor_name?: string | null;
  department?: string | null;
  type: string;
  issued_at: string | Date;
}) => {
  const { token_number, patient_name, doctor_name, department, type, issued_at } = token;

  const typeLabel: Record<string, string> = {
    walk_in: "Walk-In",
    appointment: "Appointment",
    emergency: "⚠ EMERGENCY",
  };
  const label = typeLabel[type] || type;

  const time = new Date(issued_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const win = window.open("", "_blank", "width=320,height=480");
  if (!win) return;

  win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Token ${token_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      width: 300px;
      padding: 16px;
      text-align: center;
    }
    .hospital { font-size: 12px; color: #555; margin-bottom: 4px; }
    .type-badge {
      display: inline-block;
      padding: 2px 10px;
      background: ${type === "emergency" ? "#dc2626" : "#1e40af"};
      color: white;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .token-number {
      font-size: 72px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -2px;
      margin: 8px 0;
    }
    .divider { border-top: 1px dashed #ccc; margin: 8px 0; }
    .label { font-size: 10px; color: #888; text-transform: uppercase; margin-top: 6px; }
    .value { font-size: 13px; font-weight: bold; }
    .footer { font-size: 10px; color: #aaa; margin-top: 12px; }
    @media print {
      body { width: 100%; }
    }
  </style>
</head>
<body>
  <p class="hospital">Hospyn Healthcare</p>
  <div class="type-badge">${label}</div>
  <div class="token-number">${token_number}</div>
  <div class="divider"></div>
  <div class="label">Patient</div>
  <div class="value">${patient_name}</div>
  <div class="label">Doctor</div>
  <div class="value">${doctor_name || "—"}</div>
  <div class="label">Department</div>
  <div class="value">${department || "—"}</div>
  <div class="divider"></div>
  <div class="label">Issued at</div>
  <div class="value">${time}</div>
  <p class="footer">Please wait for your number to be called</p>
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
};
