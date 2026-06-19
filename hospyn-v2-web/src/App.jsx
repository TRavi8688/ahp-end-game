/**
 * hospyn-v2-web/src/App.jsx
 * Fixed router — all pages wired, /hospyn-internal added, SupportButton mounted
 */
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import MarketingLanding    from './pages/MarketingLanding';
import OwnerDashboard      from './pages/OwnerDashboard';
import Network             from './pages/Network';
import Platform            from './pages/Platform';
import Vision              from './pages/Vision';
import HospynInternalPanel from './pages/HospynInternalPanel';
import QuickRegister       from './components/QuickRegister';
import ActivationWizard    from './components/ActivationWizard';
import { LedgerLoginModal } from './components/Modals';
import { SupportButton }   from './components/ticket/TicketSystem';
import PrivacyPolicy       from './pages/PrivacyPolicy';
import TermsOfService      from './pages/TermsOfService';

function isAuthenticated() {
  return !!localStorage.getItem('hospyn_owner_token');
}

function clearSession() {
  ['hospyn_owner_token','hospyn_owner_email','hospyn_org_name','hospyn_branches'].forEach(k => localStorage.removeItem(k));
}

function saveSession({ access_token, name, owner_email, branches }) {
  if (access_token) localStorage.setItem('hospyn_owner_token',  access_token);
  if (owner_email)  localStorage.setItem('hospyn_owner_email',  owner_email);
  if (name)         localStorage.setItem('hospyn_org_name',     name);
  if (branches)     localStorage.setItem('hospyn_branches',     branches);
}

function NavigationWrapper() {
  const navigate = useNavigate();
  const [authed,       setAuthed]      = useState(isAuthenticated);
  const [wizardOpen,   setWizardOpen]  = useState(false);
  const [loginOpen,    setLoginOpen]   = useState(false);

  useEffect(() => {
    const handler = () => setAuthed(isAuthenticated());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    if (authed) navigate('/dashboard', { replace: true });
  }, [authed]);

  const handleLogout = useCallback(() => {
    clearSession();
    setAuthed(false);
    navigate('/', { replace: true });
  }, [navigate]);

  const handleLoginSuccess = useCallback(data => {
    saveSession(data);
    setLoginOpen(false);
    setAuthed(true);
  }, []);

  const handleActivationSuccess = useCallback(data => {
    saveSession(data);
    setWizardOpen(false);
    setAuthed(true);
  }, []);

  return (
    <>
      <Routes>
        {/* Public marketing */}
        <Route path="/" element={authed ? <Navigate to="/dashboard" replace/> : <MarketingLanding setIsLoginModalOpen={setLoginOpen} setIsWizardOpen={setWizardOpen}/>}/>
        <Route path="/network"  element={<Network/>}/>
        <Route path="/platform" element={<Platform/>}/>
        <Route path="/vision"   element={<Vision/>}/>

        {/* Patient QR walk-in — no auth */}
        <Route path="/register" element={<QuickRegister/>}/>

        {/* Owner dashboard — auth required */}
        <Route path="/dashboard" element={
          authed
            ? <><OwnerDashboard onLogout={handleLogout}/><SupportButton/></>
            : <Navigate to="/" replace/>
        }/>

        {/* Internal Hospin support panel — separate product (route kept as /hospyn-internal, infra-stable) */}
        <Route path="/hospyn-internal" element={<HospynInternalPanel/>}/>
        <Route path="/hospyn-internal/*" element={<HospynInternalPanel/>}/>

        {/* Legal */}
        <Route path="/privacy-policy"   element={<PrivacyPolicy/>}/>
        <Route path="/terms-of-service" element={<TermsOfService/>}/>

        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>

      <ActivationWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} onActivationSuccess={handleActivationSuccess}/>
      <LedgerLoginModal isOpen={loginOpen}  onClose={() => setLoginOpen(false)}   onLoginSuccess={handleLoginSuccess}/>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <NavigationWrapper/>
    </Router>
  );
}
