import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import AdminDashboard from './pages/Dashboard/AdminDashboard';
import DoctorDashboard from './pages/Dashboard/DoctorDashboard';
import NurseDashboard from './pages/Dashboard/NurseDashboard';
import OwnerDashboard from './pages/Dashboard/OwnerDashboard';
import PharmacyDashboard from './pages/Dashboard/PharmacyDashboard';
import LabDashboard from './pages/Dashboard/LabDashboard';

// Reception section (merged from reception-portal)
import ReceptionDashboard from './pages/Dashboard/ReceptionDashboard';
import CheckInPage from './pages/Dashboard/CheckInPage';
import QueueBoardPage from './pages/Dashboard/QueueBoardPage';
import TodaysAppointmentsPage from './pages/Dashboard/TodaysAppointmentsPage';
import BillingPage from './pages/Dashboard/BillingPage';

// Public / patient-facing
import WalkInPage from './pages/WalkInPage';

/**
 * FIXES:
 * 1. Added missing /reception/walkin route (existed in reception-portal but not here).
 * 2. WalkInPage no longer imports wrong apiClient (fixed in WalkInPage.tsx).
 * 3. All reception routes grouped under one ProtectedRoute wrapper.
 * 4. Default "/" now checks auth and redirects to role-appropriate page via Login.
 */
const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Patient-facing walk-in form (public — no auth required) */}
          <Route path="/join/:signedToken" element={<WalkInPage />} />

          {/* ── Protected Routes ── */}

          <Route element={<ProtectedRoute allowedRoles={['admin', 'hospital_admin']} />}>
            <Route path="/admin" element={<Layout role="admin"><AdminDashboard /></Layout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
            <Route path="/doctor" element={<Layout role="doctor"><DoctorDashboard /></Layout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['nurse']} />}>
            <Route path="/nurse" element={<Layout role="nurse"><NurseDashboard /></Layout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['owner']} />}>
            <Route path="/owner" element={<Layout role="owner"><OwnerDashboard /></Layout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['pharmacy', 'admin']} />}>
            <Route path="/pharmacy" element={<Layout role="pharmacy"><PharmacyDashboard /></Layout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['lab', 'admin']} />}>
            <Route path="/lab" element={<Layout role="lab"><LabDashboard /></Layout>} />
          </Route>

          {/* Reception section — FIXED: added /reception/walkin */}
          <Route element={<ProtectedRoute allowedRoles={['receptionist', 'admin', 'hospital_admin']} />}>
            <Route path="/reception"              element={<Layout role="receptionist"><ReceptionDashboard /></Layout>} />
            <Route path="/reception/checkin"      element={<Layout role="receptionist"><CheckInPage /></Layout>} />
            <Route path="/reception/queue"        element={<Layout role="receptionist"><QueueBoardPage /></Layout>} />
            <Route path="/reception/appointments" element={<Layout role="receptionist"><TodaysAppointmentsPage /></Layout>} />
            <Route path="/reception/billing"      element={<Layout role="receptionist"><BillingPage /></Layout>} />
            {/* FIXED: this route was in the reception-portal but missing from staff-portal */}
            <Route path="/reception/walkin"       element={<Layout role="receptionist"><ReceptionDashboard /></Layout>} />
          </Route>

          {/* Default redirections */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/unauthorized" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
