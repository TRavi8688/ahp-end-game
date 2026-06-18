import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import receptionApi from '../services/receptionApi'
import styles from './TodaysAppointmentsPage.module.css'

const STATUS_OPTIONS = ['scheduled', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show']

const STATUS_BADGE = {
  scheduled:   { cls: 'badge-amber',  label: 'Scheduled'   },
  arrived:     { cls: 'badge-indigo', label: 'Arrived'     },
  in_progress: { cls: 'badge-teal',   label: 'In Progress' },
  completed:   { cls: 'badge-green',  label: 'Completed'   },
  cancelled:   { cls: 'badge-red',    label: 'Cancelled'   },
  no_show:     { cls: 'badge-red',    label: 'No Show'     },
}

export default function TodaysAppointmentsPage() {
  const { user }    = useAuth()
  const { toast }   = useToast()
  const hospitalId  = user?.hospital_id

  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState('all')
  const [search, setSearch]             = useState('')
  const [updating, setUpdating]         = useState(null)

  const fetch = useCallback(async () => {
    if (!hospitalId) return
    setLoading(true)
    try {
      const data = await receptionApi.getTodaysAppointments(hospitalId)
      setAppointments(Array.isArray(data) ? data : data.appointments || [])
    } catch {
      toast('Failed to load appointments', 'error')
    } finally {
      setLoading(false)
    }
  }, [hospitalId])

  useEffect(() => { fetch() }, [fetch])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    try {
      await receptionApi.updateAppointmentStatus(id, status)
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      toast('Status updated', 'success')
    } catch {
      toast('Failed to update status', 'error')
    } finally {
      setUpdating(null) }
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  const filtered = appointments.filter(a => {
    const matchFilter = filter === 'all' || a.status === filter
    const matchSearch = !search || [a.patient_name, a.doctor_name, a.patient_phone].some(v => v?.toLowerCase().includes(search.toLowerCase()))
    return matchFilter && matchSearch
  })

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = appointments.filter(a => a.status === s).length
    return acc
  }, {})

  if (loading) return <div className="page-loader"><div className="spinner" /><span>Loading appointments…</span></div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Today's Appointments</h1>
          <p className={styles.subtitle}>{today} · {appointments.length} total appointments</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetch}>↻ Refresh</button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ padding: '0 24px 20px' }}>
        {[
          { label: 'Scheduled', key: 'scheduled', color: 'var(--amber)' },
          { label: 'Arrived',   key: 'arrived',   color: 'var(--indigo)' },
          { label: 'Active',    key: 'in_progress',color: 'var(--teal-light)' },
          { label: 'Completed', key: 'completed',  color: 'var(--green)' },
        ].map(s => (
          <div key={s.key} className="stat-card">
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color }}>{counts[s.key] || 0}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input className="form-input" style={{ maxWidth: 280 }} placeholder="Search patient or doctor…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.filterBtns}>
          <button className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`} onClick={() => setFilter('all')}>
            All ({appointments.length})
          </button>
          {STATUS_OPTIONS.map(s => (
            <button key={s} className={`${styles.filterBtn} ${filter === s ? styles.active : ''}`} onClick={() => setFilter(s)}>
              {STATUS_BADGE[s]?.label} {counts[s] > 0 ? `(${counts[s]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <h3>No appointments found</h3>
            <p>Try adjusting the filter or search term</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const badge = STATUS_BADGE[a.status] || { cls: 'badge-amber', label: a.status }
                const time  = a.appointment_time
                  ? new Date(a.appointment_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : a.time_slot || '—'

                return (
                  <tr key={a.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{time}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.patient_name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.patient_phone}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>Dr. {a.doctor_name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.specialty}</div>
                    </td>
                    <td>
                      <span className="badge badge-indigo">{a.appointment_type || 'OPD'}</span>
                    </td>
                    <td>
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ fontSize: 12, padding: '5px 10px', minWidth: 130 }}
                        value={a.status}
                        onChange={e => updateStatus(a.id, e.target.value)}
                        disabled={updating === a.id || a.status === 'completed' || a.status === 'cancelled'}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{STATUS_BADGE[s]?.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
