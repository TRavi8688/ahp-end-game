import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import receptionApi from '../services/receptionApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [token, setToken]       = useState(() => localStorage.getItem('reception_token'))
  const [loading, setLoading]   = useState(true)

  // On mount, validate existing token
  useEffect(() => {
    const stored = localStorage.getItem('reception_token')
    if (stored) {
      receptionApi.getMe()
        .then(data => { setUser(data); setToken(stored) })
        .catch(() => { localStorage.removeItem('reception_token'); setToken(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (phone, password) => {
    const data = await receptionApi.login(phone, password)
    const { access_token, user: userData } = data
    localStorage.setItem('reception_token', access_token)
    setToken(access_token)
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('reception_token')
    setToken(null)
    setUser(null)
  }, [])

  const value = { user, token, loading, login, logout, isAuthenticated: !!token }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
