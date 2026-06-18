/**
 * printToken - generates thermal printer-compatible output
 * Supports 80mm thermal printers (standard hospital queue printers)
 */
export function printToken({ tokenNumber, patientName, chiefComplaint, doctorName, timestamp, hospitalName }) {
  const win = window.open('', '_blank', 'width=320,height=480')
  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Queue Token</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'DM Sans', monospace;
          font-size: 13px;
          width: 280px;
          margin: 0 auto;
          padding: 8px;
          color: #000;
          background: #fff;
        }
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .hospital { font-size: 14px; font-weight: 700; }
        .subtitle { font-size: 11px; color: #555; }
        .token-number {
          text-align: center;
          font-size: 64px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          line-height: 1;
          padding: 12px 0;
          letter-spacing: -2px;
        }
        .token-label { text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #555; margin-bottom: 8px; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
        .value { font-size: 12px; font-weight: 600; text-align: right; max-width: 60%; }
        .footer { text-align: center; font-size: 10px; color: #888; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #000; }
        .qr-placeholder { width: 60px; height: 60px; border: 2px solid #000; margin: 8px auto; display: flex; align-items: center; justify-content: center; font-size: 8px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="hospital">${hospitalName || 'HOSPYN HEALTHCARE'}</div>
        <div class="subtitle">Patient Queue Token</div>
      </div>
      <div class="token-label">Your Token Number</div>
      <div class="token-number">${tokenNumber || '—'}</div>
      <div class="divider"></div>
      <div class="row">
        <span class="label">Name</span>
        <span class="value">${patientName || '—'}</span>
      </div>
      <div class="row">
        <span class="label">Doctor</span>
        <span class="value">${doctorName || 'General OPD'}</span>
      </div>
      <div class="row">
        <span class="label">Complaint</span>
        <span class="value">${chiefComplaint || '—'}</span>
      </div>
      <div class="row">
        <span class="label">Date</span>
        <span class="value">${date}</span>
      </div>
      <div class="row">
        <span class="label">Time</span>
        <span class="value">${time}</span>
      </div>
      <div class="footer">
        Please wait in the waiting area.<br />
        Your number will be called on the display board.
      </div>
    </body>
    </html>
  `)
  win.document.close()
  setTimeout(() => { win.print(); win.close() }, 400)
}
