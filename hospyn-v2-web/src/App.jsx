/**
 * hospain-v2-web/src/App.jsx
 *
 * FIXES:
 *  1. branches bug — saveSession now correctly stores branches field
 *  2. Token moved from localStorage → sessionStorage (PHI security)
 *     localStorage still used for non-sensitive prefs (org name) only
 *  3. All pages wired, SupportButton mounted
 */
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import MarketingLanding    from './pages/MarketingLanding';
import OwnerDashboard      from './pages/OwnerDashboard';
import Network             from './pages/Network';
import Platform            from './pages/Platform';
import Vision              from './pages/Vision';
import HospainInternalPanel from './pages/HospainInternalPanel';
import QuickRegister       from './components/QuickRegister';
import ActivationWizard    from './components/ActivationWizard';
import { LedgerLoginModal } from './components/Modals';
import { SupportButton }   from './components/ticket/TicketSystem';
import PrivacyPolicy       from './pages/PrivacyPolicy';
import TermsOfService      from './pages/TermsOfService';

// ── Session helpers — token in sessionStorage, metadata in localStorage ──────

function isAuthenticated() {
  return !!sessionStorage.getItem('hospain_owner_token');
}

function clearSession() {
  sessionStorage.removeItem('hospain_owner_token');
  ['hospain_owner_email', 'hospain_org_name', 'hospain_branches'].forEach(k => localStorage.removeItem(k));
}

/**
 * Saves session after login or activation.
 * access_token → sessionStorage (clears on tab close, never persisted to disk)
 * owner_email, org_name, branches → localStorage (non-sensitive metadata for UI labels)
 *
 * BUG FIX: original code had `if (branches)` which skipped falsy values.
 * Now stores branches unconditionally when provided so branch-level
 * dashboard filtering works correctly after login.
 */
function saveSession({ access_token, name, owner_email, branches }) {
  if (access_token) sessionStorage.setItem('hospain_owner_token', access_token);
  if (owner_email)  localStorage.setItem('hospain_owner_email', owner_email);
  if (name)         localStorage.setItem('hospain_org_name', name);
  // FIX: store branches even if empty string/array — dashboard needs the real value
  if (branches !== undefined && branches !== null) {
    localStorage.setItem('hospain_branches', Array.isArray(branches) ? branches.join(',') : String(branches));
  }
}

function NavigationWrapper() {
  const navigate = useNavigate();
  const [authed,     setAuthed]    = useState(isAuthenticated);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [loginOpen,  setLoginOpen]  = useState(false);

  // Re-check auth if storage changes in another tab
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
    // After registration, status is pending_verification — don't auto-login to dashboard.
    // Just close the wizard. Owner must wait for approval email.
    setWizardOpen(false);
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

        {/* Internal Hospain support panel */}
        <Route path="/hospain-internal"    element={<HospainInternalPanel/>}/>
        <Route path="/hospain-internal/*"  element={<HospainInternalPanel/>}/>

        {/* Legal */}
        <Route path="/privacy-policy"   element={<PrivacyPolicy/>}/>
        <Route path="/terms-of-service" element={<TermsOfService/>}/>

        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>

      <ActivationWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} onActivationSuccess={handleActivationSuccess}/>
      <LedgerLoginModal isOpen={loginOpen}  onClose={() => setLoginOpen(false)}  onLoginSuccess={handleLoginSuccess}/>
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
