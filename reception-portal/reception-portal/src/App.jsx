import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ReceptionRoutes from './routes/receptionRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ReceptionRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
