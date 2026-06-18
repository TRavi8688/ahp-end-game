import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './ReceptionLayout.module.css'

const NAV = [
  { to: '/reception/queue',        label: 'Live Queue',      icon: '⚡' },
  { to: '/reception/checkin',      label: 'Check-In',        icon: '✔' },
  { to: '/reception/walkin',       label: 'Walk-In Register',icon: '🚶' },
  { to: '/reception/appointments', label: 'Appointments',    icon: '📅' },
  { to: '/reception/billing',      label: 'Billing',         icon: '💳' },
]

export default function ReceptionLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={`${styles.layout} ${collapsed ? styles.collapsed : ''}`}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>H</span>
          {!collapsed && <div><span className={styles.brandName}>Hospyn</span><span className={styles.brandSub}>Reception</span></div>}
        </div>

        <nav className={styles.nav}>
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{n.icon}</span>
              {!collapsed && <span className={styles.navLabel}>{n.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {!collapsed && user && (
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>{(user.name || user.phone || 'R')[0].toUpperCase()}</div>
              <div>
                <div className={styles.userName}>{user.name || 'Receptionist'}</div>
                <div className={styles.userRole}>Reception Staff</div>
              </div>
            </div>
          )}
          <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)} title="Toggle sidebar">
            {collapsed ? '→' : '←'}
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
            {collapsed ? '⏻' : '⏻ Logout'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
