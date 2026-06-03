import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MarketingLanding from './pages/MarketingLanding';
import OwnerDashboard from './pages/OwnerDashboard';
import QuickRegister from './components/QuickRegister';
import ActivationWizard from './components/ActivationWizard';
import { LedgerLoginModal } from './components/Modals';

function NavigationWrapper() {
  const navigate = useNavigate();
  const [appStatus, setAppStatus] = useState(() => {
    return localStorage.getItem('hospyn_app_state') || 'unregistered';
  });
  
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    // If approved, automatically redirect to dashboard
    if (appStatus === 'approved') {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  }, [appStatus]);


  const handleLogout = () => {
    localStorage.removeItem('hospyn_app_state');
    localStorage.removeItem('hospyn_owner_token');
    localStorage.removeItem('hospyn_owner_email');
    setAppStatus('unregistered');
  };

  return (
    <>
      <Routes>
        <Route 
          path="/" 
          element={
            appStatus === 'approved' ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <MarketingLanding 
                appStatus={appStatus}
                setIsLoginModalOpen={setIsLoginModalOpen}
                setIsWizardOpen={setIsWizardOpen}
              />
            )
          } 
        />
        
        <Route path="/register" element={<QuickRegister />} />
        
        <Route 
          path="/dashboard" 
          element={
            appStatus === 'approved' ? (
              <OwnerDashboard onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Shared Overlays */}
      <ActivationWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
        onActivationSuccess={(data) => {
          setAppStatus('approved');
          localStorage.setItem('hospyn_app_state', 'approved');
          localStorage.setItem('hospyn_org_name', data.name);
          localStorage.setItem('hospyn_owner_email', data.owner_email);
          if (data.owner_password) {
            localStorage.setItem('hospyn_owner_password', data.owner_password);
          }
          if (data.branches) {
            localStorage.setItem('hospyn_branches', data.branches);
          }
          setIsWizardOpen(false);
        }}
      />

      <LedgerLoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(data) => {
          setIsLoginModalOpen(false);
          setAppStatus('approved');
          localStorage.setItem('hospyn_app_state', 'approved');
          localStorage.setItem('hospyn_org_name', data.name);
          localStorage.setItem('hospyn_owner_email', data.owner_email);
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <NavigationWrapper />
    </Router>
  );
}
