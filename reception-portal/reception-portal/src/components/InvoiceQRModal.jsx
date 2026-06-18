import React from 'react'

// Simple QR code URL-based display (uses Google Charts API for rendering)
function QRImage({ value, size = 140 }) {
  const url = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(value)}&choe=UTF-8`
  return <img src={url} alt="QR Code" width={size} height={size} style={{ borderRadius: 8 }} />
}

export default function InvoiceQRModal({ invoice, onClose }) {
  if (!invoice) return null

  const paymentUrl = `upi://pay?pa=hospyn@upi&pn=Hospyn+Healthcare&am=${invoice.total_amount}&tn=Invoice+${invoice.invoice_number}&cu=INR`

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div className="modal-header">
          <span className="modal-title">Pay Invoice #{invoice.invoice_number}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Scan to pay via UPI
          </p>

          <div style={{ background: '#fff', padding: 12, borderRadius: 12 }}>
            <QRImage value={paymentUrl} size={160} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Patient</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{invoice.patient_name || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Amount Due</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--teal-light)' }}>
                ₹{Number(invoice.total_amount || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            UPI ID: hospyn@upi · Payment will reflect in 30 seconds
          </p>

          <button className="btn btn-outline" style={{ width: '100%' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
