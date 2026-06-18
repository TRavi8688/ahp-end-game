import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import ReceptionLayout from '../components/ReceptionLayout'
import LoginPage                from '../pages/LoginPage'
import QueueBoardPage           from '../pages/QueueBoardPage'
import CheckInPage              from '../pages/CheckInPage'
import WalkInPage               from '../pages/WalkInPage'
import TodaysAppointmentsPage   from '../pages/TodaysAppointmentsPage'
import BillingPage              from '../pages/BillingPage'

function LayoutWrapper({ children }) {
  return (
    <ProtectedRoute>
      <ReceptionLayout>{children}</ReceptionLayout>
    </ProtectedRoute>
  )
}

export default function ReceptionRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — wrapped in layout */}
      <Route path="/reception/queue"        element={<LayoutWrapper><QueueBoardPage /></LayoutWrapper>} />
      <Route path="/reception/checkin"      element={<LayoutWrapper><CheckInPage /></LayoutWrapper>} />
      <Route path="/reception/walkin"       element={<LayoutWrapper><WalkInPage /></LayoutWrapper>} />
      <Route path="/reception/appointments" element={<LayoutWrapper><TodaysAppointmentsPage /></LayoutWrapper>} />
      <Route path="/reception/billing"      element={<LayoutWrapper><BillingPage /></LayoutWrapper>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/reception/queue" replace />} />
      <Route path="*" element={<Navigate to="/reception/queue" replace />} />
    </Routes>
  )
}
