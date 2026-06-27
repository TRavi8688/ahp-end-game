import React, { useState, useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { useIdleLogout } from './hooks/useIdleLogout';

// Components
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ScanModal from './components/ScanModal';
import ErrorBoundary from './components/ErrorBoundary';

// Context
import { SocketProvider } from './contexts/SocketContext';

// Pages
import LoginScreen from './pages/LoginScreen';
import SignupScreen from './pages/SignupScreen';
import HomeDashboard from './pages/HomeDashboard';
import PatientDetailView from './pages/PatientDetailView';
import PatientRecordView from './pages/PatientRecordView';
import PatientList from './pages/PatientList';
import AccessHistory from './pages/AccessHistory';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import Schedule from './pages/Schedule';
import Analytics from './pages/Analytics';
import PrescriptionBuilder from './pages/PrescriptionBuilder';
import QueueScreen from './pages/QueueScreen';
import EarningsDashboard from './pages/EarningsDashboard';
import LeaveManagement from './pages/LeaveManagement';
import NotificationsScreen from './pages/NotificationsScreen';

const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#0D9488' },
        secondary: { main: '#6366F1' },
        warning: { main: '#F59E0B' },
        background: {
            default: '#050810',
            paper: '#0A0E1A'
        },
        text: {
            primary: '#F8FAFC',
            secondary: '#94A3B8'
        }
    },
    typography: {
        fontFamily: '"DM Sans", "Inter", sans-serif',
        h1: { fontFamily: '"Syne", "Outfit", sans-serif', fontWeight: 800, letterSpacing: '-0.03em' },
        h2: { fontFamily: '"Syne", "Outfit", sans-serif', fontWeight: 800, letterSpacing: '-0.02em' },
        h3: { fontFamily: '"Syne", "Outfit", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
        h4: { fontFamily: '"Syne", "Outfit", sans-serif', fontWeight: 700 },
        h5: { fontFamily: '"Syne", "Outfit", sans-serif', fontWeight: 700 },
        h6: { fontFamily: '"Syne", "Outfit", sans-serif', fontWeight: 700 },
        subtitle1: { fontFamily: '"DM Sans", sans-serif', fontWeight: 600 },
        subtitle2: { fontFamily: '"DM Sans", sans-serif', fontWeight: 600 },
        body1: { fontFamily: '"DM Sans", "Inter", sans-serif' },
        body2: { fontFamily: '"DM Sans", "Inter", sans-serif' },
        button: { fontFamily: '"DM Sans", sans-serif', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'none' },
        caption: { fontFamily: '"Space Mono", monospace', fontWeight: 500, letterSpacing: '0.05em' },
        overline: { fontFamily: '"Space Mono", monospace', fontWeight: 700, letterSpacing: '0.1em' }
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: '#050810',
                    backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(13, 148, 136, 0.05) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(99, 102, 241, 0.05) 0%, transparent 50%)',
                    backgroundAttachment: 'fixed',
                    minHeight: '100vh',
                    color: '#F8FAFC'
                },
                '.glass-card': {
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                    borderRadius: '24px',
                }
            }
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: '24px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                }
            }
        }
    }
});

function AppContent() {
    const token = sessionStorage.getItem('hospain_access_token');
    let isDoctor = false;
    if (token) {
        try {
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                isDoctor = payload.role === 'doctor';
            }
        } catch (e) {
            console.error("Token decode error:", e);
        }
    }

    // FIXED: was `(localStorage.getItem('isAuthenticated') === 'true') && isDoctor`.
    // localStorage persists across tabs/windows; sessionStorage (where the
    // actual JWT lives) is per-tab. Opening a brand-new tab found
    // isAuthenticated=true in localStorage but no token in that tab's
    // sessionStorage, so isDoctor was false and the user got bounced to
    // /login despite having a perfectly valid session in their other tab.
    // Auth state now comes entirely from this tab's sessionStorage token,
    // which is the only thing that's actually authoritative.
    const isAuthenticated = Boolean(token) && isDoctor;
    const [scanModalOpen, setScanModalOpen] = useState(false);

    useEffect(() => {
        if (token && !isDoctor) {
            sessionStorage.removeItem('hospain_access_token');
            localStorage.removeItem('isAuthenticated'); // legacy key cleanup
            localStorage.removeItem('isVerified');
            window.location.href = '/login';
        }
    }, [token, isDoctor]);

    const handleLogout = () => {
        sessionStorage.removeItem('hospain_access_token');
        localStorage.removeItem('isAuthenticated'); // legacy key cleanup
        localStorage.removeItem('isVerified');
        window.location.href = '/login';
    };

    useEffect(() => {
        import('./utils/ApiService').then(({ default: ApiService }) => {
            ApiService.setAuthFailureCallback(handleLogout);
        });
    }, []);

    useIdleLogout(handleLogout, isAuthenticated);

    if (!isAuthenticated) {
        return (
            <Routes>
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/verify" element={<SignupScreen />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar onOpenScan={() => setScanModalOpen(true)} />
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Topbar onLogout={handleLogout} onOpenScan={() => setScanModalOpen(true)} />
                <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
                    <ErrorBoundary>
                        <Routes>
                            <Route path="/" element={<HomeDashboard onOpenScan={() => setScanModalOpen(true)} />} />
                            <Route path="/queue" element={<QueueScreen />} />
                            <Route path="/patient/:id/*" element={<PatientDetailView />} />
                            <Route path="/patient-record/:patientId" element={<PatientRecordView />} />
                            <Route path="/patients" element={<PatientList />} />
                            <Route path="/schedule" element={<Schedule />} />
                            <Route path="/history" element={<AccessHistory />} />
                            <Route path="/prescriptions" element={<PrescriptionBuilder />} />
                            <Route path="/prescriptions/:patientId" element={<PrescriptionBuilder />} />
                            <Route path="/analytics" element={<Analytics />} />
                            <Route path="/alerts" element={<Alerts />} />
                            <Route path="/notifications" element={<NotificationsScreen />} />
                            <Route path="/earnings" element={<EarningsDashboard />} />
                            <Route path="/leave" element={<LeaveManagement />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </ErrorBoundary>
                </Box>
            </Box>
            <ScanModal open={scanModalOpen} onClose={() => setScanModalOpen(false)} />
        </Box>
    );
}

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {/* SocketProvider wraps everything so useSocket() works in all pages */}
            <SocketProvider>
                <AppContent />
            </SocketProvider>
        </ThemeProvider>
    );
}

export default App;
