import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useLiveQueue } from '../hooks/useLiveQueue'
import receptionApi from '../services/receptionApi'
import styles from './QueueBoardPage.module.css'

const STATUS_BADGE = {
  waiting:    { cls: 'badge-amber',  label: 'Waiting'   },
  called:     { cls: 'badge-teal',   label: 'Called'    },
  with_doctor:{ cls: 'badge-indigo', label: 'With Doctor'},
  done:       { cls: 'badge-green',  label: 'Done'      },
  skipped:    { cls: 'badge-red',    label: 'Skipped'   },
}

export default function QueueBoardPage() {
  const { user }      = useAuth()
  const { toast }     = useToast()
  const hospitalId    = user?.hospital_id
  const { queue, loading, error, refetch } = useLiveQueue(hospitalId)
  const [stats, setStats] = useState(null)
  const [acting, setActing] = useState(null)

  useEffect(() => {
    if (!hospitalId) return
    receptionApi.getReceptionStats(hospitalId).then(setStats).catch(() => {})
  }, [hospitalId])

  const waiting = queue.filter(t => t.status === 'waiting')
  const called  = queue.filter(t => t.status === 'called' || t.status === 'with_doctor')
  const done    = queue.filter(t => t.status === 'done' || t.status === 'skipped')

  const callNext = async () => {
    setActing('next')
    try {
      await receptionApi.callNext(hospitalId)
      toast('Next patient called', 'success')
      refetch()
    } catch {
      toast('Failed to call next patient', 'error')
    } finally { setActing(null) }
  }

  const skip = async (tokenId) => {
    setActing(tokenId)
    try {
      await receptionApi.skipToken(tokenId)
      toast('Token skipped', 'info')
      refetch()
    } catch {
      toast('Failed to skip token', 'error')
    } finally { setActing(null) }
  }

  const complete = async (tokenId) => {
    setActing(tokenId)
    try {
      await receptionApi.completeToken(tokenId)
      toast('Consultation completed', 'success')
      refetch()
    } catch {
      toast('Failed to complete token', 'error')
    } finally { setActing(null) }
  }

  if (loading) return <div className="page-loader"><div className="spinner"/><span>Loading queue...</span></div>
  if (error)   return <div className="page-loader"><span style={{color:'var(--red)'}}>⚠ {error}</span></div>

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Live Queue</h1>
          <p className={styles.subtitle}>
            <span className={styles.liveDoc}>● LIVE</span> · {queue.length} total today
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-outline btn-sm" onClick={refetch}>↻ Refresh</button>
          <button
            className="btn btn-primary"
            onClick={callNext}
            disabled={acting === 'next' || waiting.length === 0}
          >
            {acting === 'next' ? 'Calling…' : '▶ Call Next'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ padding: '0 24px 20px' }}>
        <div className="stat-card">
          <div className="stat-card-label">Waiting</div>
          <div className="stat-card-value" style={{ color: 'var(--amber)' }}>{waiting.length}</div>
          <div className="stat-card-sub">in queue</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">With Doctor</div>
          <div className="stat-card-value" style={{ color: 'var(--teal-light)' }}>{called.length}</div>
          <div className="stat-card-sub">active now</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Completed</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{done.length}</div>
          <div className="stat-card-sub">today</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avg Wait</div>
          <div className="stat-card-value">{stats?.avg_wait_minutes ?? '—'}</div>
          <div className="stat-card-sub">minutes</div>
        </div>
      </div>

      {/* Queue columns */}
      <div className={styles.columns}>
        {/* Waiting */}
        <div className={styles.column}>
          <div className={styles.colHeader}>
            <span className="badge badge-amber">Waiting ({waiting.length})</span>
          </div>
          <div className={styles.colBody}>
            {waiting.length === 0 && (
              <div className="empty-state"><div className="empty-state-icon">✓</div><h3>Queue is empty</h3></div>
            )}
            {waiting.map(t => (
              <QueueCard key={t.id} token={t} onSkip={skip} acting={acting} />
            ))}
          </div>
        </div>

        {/* Called / With Doctor */}
        <div className={styles.column}>
          <div className={styles.colHeader}>
            <span className="badge badge-teal">Active ({called.length})</span>
          </div>
          <div className={styles.colBody}>
            {called.length === 0 && (
              <div className="empty-state"><div className="empty-state-icon">⏳</div><h3>No active consultations</h3></div>
            )}
            {called.map(t => (
              <QueueCard key={t.id} token={t} onComplete={complete} acting={acting} />
            ))}
          </div>
        </div>

        {/* Done */}
        <div className={styles.column}>
          <div className={styles.colHeader}>
            <span className="badge badge-green">Completed ({done.length})</span>
          </div>
          <div className={styles.colBody}>
            {done.length === 0 && (
              <div className="empty-state"><div className="empty-state-icon">📋</div><h3>No completed visits yet</h3></div>
            )}
            {done.slice(-10).reverse().map(t => (
              <QueueCard key={t.id} token={t} acting={acting} readonly />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function QueueCard({ token: t, onSkip, onComplete, acting, readonly }) {
  const badge = STATUS_BADGE[t.status] || { cls: 'badge-amber', label: t.status }
  const isBusy = acting === t.id

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.tokenNum}>#{t.token_number || t.queue_number}</div>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </div>
      <div className={styles.cardName}>{t.patient_name || 'Walk-in Patient'}</div>
      {t.chief_complaint && (
        <div className={styles.cardComplaint}>{t.chief_complaint}</div>
      )}
      {t.doctor_name && (
        <div className={styles.cardDoc}>Dr. {t.doctor_name}</div>
      )}
      {!readonly && (
        <div className={styles.cardActions}>
          {onSkip && (
            <button className="btn btn-outline btn-sm" onClick={() => onSkip(t.id)} disabled={isBusy}>
              Skip
            </button>
          )}
          {onComplete && (
            <button className="btn btn-primary btn-sm" onClick={() => onComplete(t.id)} disabled={isBusy}>
              {isBusy ? '…' : '✓ Done'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
