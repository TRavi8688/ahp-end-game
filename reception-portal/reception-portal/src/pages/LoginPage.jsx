import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const { login }    = useAuth()
  const { toast }    = useToast()
  const navigate     = useNavigate()
  const [form, setForm] = useState({ phone: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.phone || !form.password) {
      toast('Please enter phone and password', 'error')
      return
    }
    setLoading(true)
    try {
      await login(form.phone, form.password)
      toast('Welcome back!', 'success')
      navigate('/reception/queue')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid credentials'
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Background grid */}
      <div className={styles.bg} />

      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>H</span>
          <div>
            <div className={styles.logoName}>Hospyn</div>
            <div className={styles.logoSub}>Reception Portal</div>
          </div>
        </div>

        <h1 className={styles.title}>Sign In</h1>
        <p className={styles.subtitle}>Access your reception dashboard</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              name="phone"
              className="form-input"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p className={styles.footer}>
          Hospyn Healthcare Platform · Reception Staff Access Only
        </p>
      </div>
    </div>
  )
}
