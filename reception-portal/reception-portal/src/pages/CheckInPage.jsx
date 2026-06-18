import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { usePatientSearch } from '../hooks/usePatientSearch'
import receptionApi from '../services/receptionApi'
import { printToken } from '../services/printToken'
import styles from './CheckInPage.module.css'

export default function CheckInPage() {
  const { user }  = useAuth()
  const { toast } = useToast()
  const hospitalId = user?.hospital_id
  const { query, setQuery, results, loading: searching } = usePatientSearch()

  const [selected, setSelected]     = useState(null)
  const [doctors, setDoctors]       = useState([])
  const [form, setForm]             = useState({ doctor_id: '', chief_complaint: '' })
  const [loading, setLoading]       = useState(false)
  const [lastToken, setLastToken]   = useState(null)

  useEffect(() => {
    if (!hospitalId) return
    receptionApi.getDoctors(hospitalId).then(d => setDoctors(Array.isArray(d) ? d : d.doctors || [])).catch(() => {})
  }, [hospitalId])

  const selectPatient = (p) => {
    setSelected(p)
    setQuery('')
  }

  const handleCheckIn = async e => {
    e.preventDefault()
    if (!selected) { toast('Please select a patient', 'error'); return }
    if (!form.chief_complaint.trim()) { toast('Chief complaint is required', 'error'); return }
    setLoading(true)
    try {
      const result = await receptionApi.checkIn(selected.id, form.doctor_id || null, form.chief_complaint)
      setLastToken({ ...result, patient_name: selected.full_name || selected.name })
      toast(`Token #${result.token_number || result.queue_number} assigned!`, 'success')
      setSelected(null)
      setForm({ doctor_id: '', chief_complaint: '' })
    } catch (err) {
      toast(err.response?.data?.detail || 'Check-in failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!lastToken) return
    printToken({
      tokenNumber: lastToken.token_number || lastToken.queue_number,
      patientName: lastToken.patient_name,
      chiefComplaint: lastToken.chief_complaint,
      hospitalName: user?.hospital_name,
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Patient Check-In</h1>
          <p className={styles.subtitle}>Search for an existing patient and assign them to the queue</p>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.formCard}>
          {/* Step 1: Search */}
          <div className={styles.step}>
            <div className={styles.stepNum}>1</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Find Patient</h3>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  placeholder="Search by name, phone, or patient ID…"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelected(null) }}
                />
                {searching && (
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                    <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  </div>
                )}
              </div>

              {/* Search results */}
              {results.length > 0 && !selected && (
                <div className={styles.searchResults}>
                  {results.map(p => (
                    <button key={p.id} className={styles.resultItem} onClick={() => selectPatient(p)}>
                      <div className={styles.resultAvatar}>{(p.full_name || p.name || '?')[0]}</div>
                      <div>
                        <div className={styles.resultName}>{p.full_name || p.name}</div>
                        <div className={styles.resultSub}>{p.phone} · {p.age ? `${p.age}y` : ''} {p.gender || ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected patient chip */}
              {selected && (
                <div className={styles.selectedPatient}>
                  <div className={styles.resultAvatar} style={{ background: 'var(--teal)', color: '#fff' }}>
                    {(selected.full_name || selected.name || '?')[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{selected.full_name || selected.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.phone} · {selected.age}y {selected.gender}</div>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>Change</button>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Check-in form */}
          {selected && (
            <form onSubmit={handleCheckIn}>
              <div className={styles.step}>
                <div className={styles.stepNum}>2</div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>Visit Details</h3>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Chief Complaint *</label>
                    <textarea
                      className="form-input" rows={3}
                      placeholder="Why is the patient visiting today?"
                      value={form.chief_complaint}
                      onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                      style={{ resize: 'vertical' }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign Doctor</label>
                    <select className="form-select" value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
                      <option value="">General OPD</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name} — {d.specialty || d.department}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
                    style={{ justifyContent: 'center', width: '100%', marginTop: 16 }}>
                    {loading ? 'Checking in…' : '✔ Check In & Assign Token'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Token result */}
        {lastToken && (
          <div className={styles.tokenCard}>
            <div style={{ fontSize: 32 }}>✅</div>
            <div className={styles.tokenNum}>#{lastToken.token_number || lastToken.queue_number}</div>
            <div className={styles.tokenLabel}>Checked In</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lastToken.patient_name}</div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handlePrint}>🖨 Print Token</button>
            <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => setLastToken(null)}>Clear</button>
          </div>
        )}
      </div>
    </div>
  )
}
