import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { usePatientSearch } from '../hooks/usePatientSearch'
import receptionApi from '../services/receptionApi'
import { printToken } from '../services/printToken'
import styles from './WalkInPage.module.css'

const GENDERS = ['Male', 'Female', 'Other']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']

export default function WalkInPage() {
  const { user }    = useAuth()
  const { toast }   = useToast()
  const hospitalId  = user?.hospital_id

  const [form, setForm] = useState({
    full_name: '', phone: '', age: '', gender: 'Male',
    blood_group: 'Unknown', chief_complaint: '', doctor_id: '',
    emergency: false,
  })
  const [doctors, setDoctors]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [lastToken, setLastToken] = useState(null)

  useEffect(() => {
    if (!hospitalId) return
    receptionApi.getDoctors(hospitalId).then(d => setDoctors(Array.isArray(d) ? d : d.doctors || [])).catch(() => {})
  }, [hospitalId])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.full_name.trim()) { toast('Full name is required', 'error'); return }
    if (!form.phone.trim())     { toast('Phone number is required', 'error'); return }
    if (!form.chief_complaint.trim()) { toast('Chief complaint is required', 'error'); return }

    setLoading(true)
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        age: form.age ? parseInt(form.age) : null,
        gender: form.gender,
        blood_group: form.blood_group,
        chief_complaint: form.chief_complaint.trim(),
        doctor_id: form.doctor_id || null,
        hospital_id: hospitalId,
        is_emergency: form.emergency,
      }
      const result = await receptionApi.registerWalkIn(payload)
      setLastToken(result)
      toast(`Token #${result.token_number || result.queue_number} registered!`, 'success')
      // Reset form
      setForm({ full_name: '', phone: '', age: '', gender: 'Male', blood_group: 'Unknown', chief_complaint: '', doctor_id: '', emergency: false })
    } catch (err) {
      toast(err.response?.data?.detail || 'Registration failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!lastToken) return
    const doctor = doctors.find(d => d.id === lastToken.doctor_id)
    printToken({
      tokenNumber: lastToken.token_number || lastToken.queue_number,
      patientName: lastToken.patient_name,
      chiefComplaint: lastToken.chief_complaint,
      doctorName: doctor ? `${doctor.name}` : null,
      hospitalName: user?.hospital_name || 'Hospyn Healthcare',
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Walk-In Registration</h1>
          <p className={styles.subtitle}>Register a new patient visiting for the first time</p>
        </div>
      </div>

      <div className={styles.content}>
        {/* Form */}
        <div className={styles.formCard}>
          <h2 className={styles.sectionTitle}>Patient Details</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Row 1 */}
            <div className={styles.row2}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" placeholder="Patient full name"
                  value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input className="form-input" type="tel" placeholder="+91 98765 43210"
                  value={form.phone} onChange={e => set('phone', e.target.value)} required />
              </div>
            </div>

            {/* Row 2 */}
            <div className={styles.row3}>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input className="form-input" type="number" placeholder="Years" min={0} max={150}
                  value={form.age} onChange={e => set('age', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select className="form-select" value={form.blood_group} onChange={e => set('blood_group', e.target.value)}>
                  {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
            </div>

            {/* Chief complaint */}
            <div className="form-group">
              <label className="form-label">Chief Complaint *</label>
              <textarea className="form-input" rows={3}
                placeholder="Describe the main reason for this visit..."
                value={form.chief_complaint}
                onChange={e => set('chief_complaint', e.target.value)}
                style={{ resize: 'vertical' }}
                required
              />
            </div>

            {/* Doctor assignment */}
            <div className="form-group">
              <label className="form-label">Assign Doctor</label>
              <select className="form-select" value={form.doctor_id} onChange={e => set('doctor_id', e.target.value)}>
                <option value="">General OPD (Auto-assign)</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.name} — {d.specialty || d.department}</option>
                ))}
              </select>
            </div>

            {/* Emergency toggle */}
            <label className={styles.emergencyToggle}>
              <input type="checkbox" checked={form.emergency} onChange={e => set('emergency', e.target.checked)} />
              <span className={styles.toggleBox}></span>
              <span>Mark as Emergency — priority queue</span>
              {form.emergency && <span className="badge badge-red" style={{ marginLeft: 8 }}>EMERGENCY</span>}
            </label>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
              style={{ justifyContent: 'center' }}>
              {loading ? 'Registering…' : '✚ Register & Assign Token'}
            </button>
          </form>
        </div>

        {/* Token confirmation */}
        {lastToken && (
          <div className={styles.tokenCard}>
            <div className={styles.tokenIcon}>🎟</div>
            <div className={styles.tokenNum}>#{lastToken.token_number || lastToken.queue_number}</div>
            <div className={styles.tokenLabel}>Token Assigned</div>
            <div className={styles.tokenDetails}>
              <div><strong>{lastToken.patient_name}</strong></div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lastToken.chief_complaint}</div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handlePrint}>
              🖨 Print Token
            </button>
            <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => setLastToken(null)}>
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
