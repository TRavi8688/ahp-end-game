import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import receptionApi from '../services/receptionApi'
import InvoiceQRModal from '../components/InvoiceQRModal'
import styles from './BillingPage.module.css'

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Insurance', 'Online']

const STATUS_BADGE = {
  pending:   { cls: 'badge-amber', label: 'Pending'   },
  paid:      { cls: 'badge-green', label: 'Paid'      },
  partial:   { cls: 'badge-indigo',label: 'Partial'   },
  cancelled: { cls: 'badge-red',   label: 'Cancelled' },
  overdue:   { cls: 'badge-red',   label: 'Overdue'   },
}

export default function BillingPage() {
  const { user }  = useAuth()
  const { toast } = useToast()
  const hospitalId = user?.hospital_id

  const [invoices, setInvoices]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState('all')
  const [search, setSearch]           = useState('')
  const [qrInvoice, setQrInvoice]     = useState(null)
  const [payModal, setPayModal]       = useState(null)  // invoice to record payment for
  const [payForm, setPayForm]         = useState({ amount: '', method: 'Cash', notes: '' })
  const [paying, setPaying]           = useState(false)

  const fetch = useCallback(async () => {
    if (!hospitalId) return
    setLoading(true)
    try {
      const data = await receptionApi.getInvoices(hospitalId)
      setInvoices(Array.isArray(data) ? data : data.invoices || [])
    } catch {
      toast('Failed to load invoices', 'error')
    } finally { setLoading(false) }
  }, [hospitalId])

  useEffect(() => { fetch() }, [fetch])

  const handlePayment = async e => {
    e.preventDefault()
    if (!payForm.amount) { toast('Enter payment amount', 'error'); return }
    setPaying(true)
    try {
      await receptionApi.recordPayment(payModal.id, {
        amount: parseFloat(payForm.amount),
        payment_method: payForm.method,
        notes: payForm.notes,
      })
      toast('Payment recorded', 'success')
      setPayModal(null)
      setPayForm({ amount: '', method: 'Cash', notes: '' })
      fetch()
    } catch (err) {
      toast(err.response?.data?.detail || 'Payment failed', 'error')
    } finally { setPaying(false) }
  }

  const filtered = invoices.filter(inv => {
    const matchFilter = filter === 'all' || inv.status === filter
    const matchSearch = !search || [inv.patient_name, inv.invoice_number, inv.patient_phone].some(v => v?.toLowerCase().includes(search.toLowerCase()))
    return matchFilter && matchSearch
  })

  const totalPending = invoices.filter(i => i.status === 'pending' || i.status === 'partial').reduce((s, i) => s + (i.balance_due || i.total_amount || 0), 0)
  const totalCollected = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0)

  if (loading) return <div className="page-loader"><div className="spinner" /><span>Loading billing…</span></div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Billing & Payments</h1>
          <p className={styles.subtitle}>Today's invoices and payment collection</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetch}>↻ Refresh</button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ padding: '0 24px 20px' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Invoices</div>
          <div className="stat-card-value">{invoices.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Collected Today</div>
          <div className="stat-card-value" style={{ color: 'var(--green)', fontSize: 22 }}>
            ₹{totalCollected.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Pending Amount</div>
          <div className="stat-card-value" style={{ color: 'var(--amber)', fontSize: 22 }}>
            ₹{totalPending.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Paid</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>
            {invoices.filter(i => i.status === 'paid').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input className="form-input" style={{ maxWidth: 260 }} placeholder="Search patient or invoice #…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.filterBtns}>
          {['all', 'pending', 'partial', 'paid', 'overdue', 'cancelled'].map(f => (
            <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <h3>No invoices found</h3>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Amount</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const badge = STATUS_BADGE[inv.status] || { cls: 'badge-amber', label: inv.status }
                return (
                  <tr key={inv.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--teal-light)' }}>
                        {inv.invoice_number || `#${inv.id}`}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.patient_name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inv.patient_phone}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}</td>
                    <td>
                      <span style={{ color: inv.balance_due > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>
                        ₹{Number(inv.balance_due || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(inv.status === 'pending' || inv.status === 'partial') && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => { setPayModal(inv); setPayForm(f => ({ ...f, amount: inv.balance_due || inv.total_amount })) }}>
                              Collect
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => setQrInvoice(inv)}>
                              QR Pay
                            </button>
                          </>
                        )}
                        {inv.status === 'paid' && (
                          <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Paid</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* QR Payment Modal */}
      {qrInvoice && <InvoiceQRModal invoice={qrInvoice} onClose={() => setQrInvoice(null)} />}

      {/* Record Payment Modal */}
      {payModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPayModal(null) }}>
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">Record Payment</span>
              <button className="modal-close" onClick={() => setPayModal(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              Invoice <strong>{payModal.invoice_number}</strong> · {payModal.patient_name}
            </p>
            <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input type="number" className="form-input" placeholder="0.00" step="0.01" min="0"
                  value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input type="text" className="form-input" placeholder="Transaction ID, remarks…"
                  value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={paying}>
                  {paying ? 'Recording…' : '✓ Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
