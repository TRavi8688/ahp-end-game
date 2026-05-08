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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Protected Routes */}
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

          {/* Default Redirection */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/unauthorized" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
