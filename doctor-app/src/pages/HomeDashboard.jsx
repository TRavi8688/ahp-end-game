import React from 'react';
import { Typography, Grid, Card, CardContent, Box, Button, Chip, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import MedicationIcon from '@mui/icons-material/Medication';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import SkipNextIcon from '@mui/icons-material/SkipNext';

import { doctorService } from '../services/doctorService';
import { clinicalService } from '../services/clinicalService';

export default function HomeDashboard({ onOpenScan }) {
    const navigate = useNavigate();
    const [patients, setPatients] = React.useState([]);
    const [profile, setProfile] = React.useState(null);
    const [stats, setStats] = React.useState({
        patients_count: 0,
        schedule_count: 0,
        alerts_count: 0,
        pending_rx_count: 0
    });
    const [isLoading, setIsLoading] = React.useState(true);
    const [isOnBreak, setIsOnBreak] = React.useState(false);
    const [breakLoading, setBreakLoading] = React.useState(false);
    const [isEmergency, setIsEmergency] = React.useState(false);
    const [callingNext, setCallingNext] = React.useState(false);

    // FIXED: was a raw fetch(`${API_BASE_URL}/doctor/emergency/broadcast`)
    // with no /healthcare prefix — healthcare-core mounts everything under
    // /api/v1/healthcare/*, so this always 404'd silently (the alert()
    // success message never actually reflected whether staff were notified).
    const handleEmergency = async () => {
        setIsEmergency(true);
        try {
            await doctorService.broadcastEmergency({});
            alert('🚨 CRITICAL: EMERGENCY BROADCAST SENT. Hospital staff notified immediately.');
        } catch (error) {
            console.error('Emergency broadcast failed', error);
            alert('Failed to send broadcast. Please use alternative comms.');
        } finally {
            setTimeout(() => setIsEmergency(false), 2000);
        }
    };

    // FIXED: same missing-prefix issue as handleEmergency.
    // doctorService.startBreak()/endBreak() already point at the correct
    // /healthcare/doctor/session/break/start|end paths.
    const toggleBreak = async () => {
        setBreakLoading(true);
        try {
            if (isOnBreak) {
                await doctorService.endBreak();
            } else {
                await doctorService.startBreak();
            }
            setIsOnBreak(!isOnBreak);
        } catch (error) {
            console.error(error);
        } finally {
            setBreakLoading(false);
        }
    };

    // FIXED: there's no "start my queue session" step in the real walk-in
    // model — a doctor can start any waiting patient's consultation
    // immediately. "Call Next Patient" now starts that specific patient's
    // consultation (PATCH /doctor/queue/{walkin_id}/start) instead of
    // calling a generic "advance" endpoint on an unrelated, never-populated
    // token table that always silently no-op'd.
    const nextWaitingPatient = patients.find(
        p => ['waiting', 'waiting_doctor'].includes(p.queue_state || p.status)
    );

    const handleCallNext = async () => {
        if (!nextWaitingPatient) return;
        setCallingNext(true);
        try {
            await clinicalService.startConsultation(nextWaitingPatient.id);
            // Refresh queue after calling next
            const queueData = await clinicalService.getActiveQueue();
            setPatients(queueData?.data?.queue || queueData?.queue || []);
        } catch (error) {
            console.error('Failed to call next patient:', error);
        } finally {
            setCallingNext(false);
        }
    };

    React.useEffect(() => {
        const abortController = new AbortController();

        const fetchData = async () => {
            try {
                const [queueData, profileData, statsData] = await Promise.all([
                    clinicalService.getActiveQueue(abortController.signal),
                    doctorService.getProfile(),
                    doctorService.getStats()
                ]);

                setPatients(queueData?.data?.queue || queueData?.queue || []);
                setProfile(profileData);
                setStats(statsData || {
                    patients_count: 0,
                    schedule_count: 0,
                    alerts_count: 0,
                    pending_rx_count: 0
                });
            } catch (error) {
                if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                    console.error('Dashboard fetch error:', error);
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        return () => abortController.abort();
    }, []);

    const appointmentsToday = stats?.schedule_count || 0;
    const pendingPrescriptions = stats?.pending_rx_count || 0;
    const urgentAlertsCount = stats?.alerts_count || 0;

    return (
        <Box sx={{ width: '100%', px: { xs: 2, md: 4 }, pt: 4, pb: 6 }}>
            {/* Header */}
            <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Syne', letterSpacing: '-0.04em', mb: 1 }}>
                        {profile ? `Dr. ${profile.last_name}` : 'Clinical Commander'}
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Secure session active ·{' '}
                        <span style={{ color: '#0d9488', fontWeight: 800 }}>{appointmentsToday}</span> consults pending ·{' '}
                        <span style={{ color: '#10b981', fontWeight: 800 }}>Ecosystem Synchronized</span>
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button
                        variant="outlined"
                        color={isOnBreak ? 'success' : 'warning'}
                        startIcon={isOnBreak ? <PlayCircleFilledIcon /> : <PauseCircleFilledIcon />}
                        onClick={toggleBreak}
                        disabled={breakLoading}
                        sx={{ borderRadius: '12px', fontWeight: 700 }}
                    >
                        {isOnBreak ? 'Resume Session' : 'Take Break'}
                    </Button>
                    <Chip
                        label="HOSPYN SECURE SHELL"
                        variant="outlined"
                        sx={{ borderColor: 'rgba(13, 148, 136, 0.3)', color: '#0d9488', fontFamily: 'Space Mono', fontWeight: 700, bgcolor: 'rgba(13, 148, 136, 0.05)', px: 1 }}
                    />
                </Box>
            </Box>

            {/* Stats Grid */}
            <Grid container spacing={3} sx={{ mb: 6 }}>
                {[
                    { title: "Today's Load", value: appointmentsToday, change: 'REAL-TIME', color: '#6366f1', icon: <EventIcon sx={{ fontSize: 40 }} /> },
                    { title: 'Authorized Patients', value: stats?.patients_count || 0, change: 'SECURE', color: '#0ea5e9', icon: <PeopleIcon sx={{ fontSize: 40 }} /> },
                    { title: 'Pending Reviews', value: pendingPrescriptions, change: 'ACTION REQ', color: '#f59e0b', icon: <MedicationIcon sx={{ fontSize: 40 }} /> },
                    { title: 'System Alerts', value: urgentAlertsCount, change: urgentAlertsCount === 0 ? 'STABLE' : 'URGENT', color: urgentAlertsCount === 0 ? '#10b981' : '#ef4444', icon: <WarningAmberIcon sx={{ fontSize: 40 }} /> },
                ].map((stat) => (
                    <Grid item xs={12} sm={6} md={3} key={stat.title}>
                        <StatCard {...stat} />
                    </Grid>
                ))}
            </Grid>

            {/* Queue Control Bar */}
            <Box sx={{
                mb: 4, p: 3, borderRadius: '20px',
                background: 'rgba(13, 148, 136, 0.05)',
                border: '1px solid rgba(13, 148, 136, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2
            }}>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Outfit' }}>
                        Queue Control
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                        {patients.length > 0
                            ? `${patients.length} patient(s) in queue`
                            : 'No patients in queue right now'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<SkipNextIcon />}
                        onClick={handleCallNext}
                        disabled={callingNext || !nextWaitingPatient}
                        sx={{
                            bgcolor: '#6366f1', fontWeight: 900, borderRadius: '14px', px: 4, py: 1.5,
                            boxShadow: '0 8px 25px rgba(99, 102, 241, 0.35)',
                            '&:hover': { bgcolor: '#4f46e5', transform: 'translateY(-2px)' },
                            transition: 'all 0.2s'
                        }}
                    >
                        {callingNext ? 'Calling...' : 'Call Next Patient'}
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => navigate('/queue')}
                        sx={{ borderColor: 'rgba(99,102,241,0.4)', color: '#6366f1', fontWeight: 800, borderRadius: '14px', px: 3 }}
                    >
                        Full Queue View
                    </Button>
                </Box>
            </Box>

            {/* Two-column section */}
            <Grid container spacing={4}>
                {/* Left: Live Waiting Room */}
                <Grid item xs={12} lg={8}>
                    <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.01)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.05)', height: '100%', borderRadius: '24px' }}>
                        <Box sx={{ p: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Syne' }}>Live Waiting Room</Typography>
                            <Button
                                endIcon={<ArrowForwardIosIcon sx={{ fontSize: 10 }} />}
                                onClick={() => navigate('/queue')}
                                sx={{ fontWeight: 800, px: 2.5, py: 1, borderRadius: '12px', color: '#0d9488', border: '1px solid rgba(13, 148, 136, 0.2)', '&:hover': { bgcolor: 'rgba(13, 148, 136, 0.05)' } }}
                            >
                                Full Queue
                            </Button>
                        </Box>
                        <Box sx={{ p: 2 }}>
                            {isLoading ? (
                                <Box sx={{ p: 8, textAlign: 'center' }}>
                                    <Typography color="#64748b" sx={{ fontFamily: 'Space Mono', fontWeight: 700 }}>LOADING HIGH-FIDELITY DATA...</Typography>
                                </Box>
                            ) : !patients || patients.length === 0 ? (
                                <Box sx={{ p: 8, textAlign: 'center' }}>
                                    <Typography color="#64748b" sx={{ fontWeight: 600 }}>No active clinical encounters recorded today.</Typography>
                                </Box>
                            ) : (
                                patients.slice(0, 6).map((p) => (
                                    <AppointmentRow
                                        key={p.id}
                                        name={p.full_name || p.first_name || 'Unknown'}
                                        time={`Queue ${p.queue_number || p.token_number || '—'}`}
                                        status={p.queue_state === 'waiting_doctor' ? 'Waiting' : 'In Consult'}
                                        statusColor={p.queue_state === 'waiting_doctor' ? 'warning' : 'success'}
                                        id={p.patient_id || p.id}
                                        condition={p.reason_for_visit || p.chief_complaint || 'In Queue'}
                                    />
                                ))
                            )}
                        </Box>
                    </Card>
                </Grid>

                {/* Right: Quick Actions */}
                <Grid item xs={12} lg={4}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.01)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
                            <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Syne' }}>Quick Actions</Typography>
                            </Box>
                            <Box sx={{ p: 3 }}>
                                <Grid container spacing={2.5}>
                                    <Grid item xs={6}><QuickActionButton label="Scan QR" icon={<QrCodeScannerIcon />} onClick={onOpenScan} color="#0d9488" /></Grid>
                                    <Grid item xs={6}><QuickActionButton label="Write Rx" icon={<MedicationIcon />} onClick={() => navigate('/prescriptions')} color="#6366f1" /></Grid>
                                    <Grid item xs={6}><QuickActionButton label={isEmergency ? 'Sending...' : 'Emergency'} icon={<LocalHospitalIcon />} onClick={handleEmergency} color="#ef4444" /></Grid>
                                    <Grid item xs={6}><QuickActionButton label="Vault" icon={<FolderSharedIcon />} onClick={() => navigate('/history')} color="#8b5cf6" /></Grid>
                                </Grid>
                            </Box>
                        </Card>

                        <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.01)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
                            <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Syne' }}>Real-time Stats</Typography>
                            </Box>
                            <Box sx={{ p: 4 }}>
                                <Grid container rowSpacing={4} columnSpacing={2}>
                                    <Grid item xs={6}><MiniStat label="Encounters" value={stats?.patients_count || 0} /></Grid>
                                    <Grid item xs={6}><MiniStat label="Flags" value={stats?.alerts_count || 0} color={stats?.alerts_count > 0 ? '#ef4444' : '#10b981'} /></Grid>
                                    <Grid item xs={6}><MiniStat label="Authored Rx" value={stats?.pending_rx_count || 0} /></Grid>
                                    <Grid item xs={6}><MiniStat label="Queue" value={patients.length > 0 ? 'Active' : 'Empty'} color={patients.length > 0 ? '#10b981' : '#64748b'} /></Grid>
                                </Grid>
                            </Box>
                        </Card>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}

const StatCard = ({ title, value, change, color, icon }) => (
    <Card className="glass-card" elevation={0} sx={{ height: '100%', position: 'relative', overflow: 'hidden', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', background: 'rgba(255, 255, 255, 0.02)', '&:hover': { transform: 'translateY(-8px)', background: 'rgba(255, 255, 255, 0.05)', boxShadow: `0 20px 40px -15px rgba(0, 0, 0, 0.8), 0 0 20px ${color}22`, '& .stat-icon': { transform: 'scale(1.2) rotate(-5deg)', opacity: 0.5 } } }}>
        <Box className="stat-icon" sx={{ position: 'absolute', top: 16, right: 16, transition: 'all 0.4s', opacity: 0.15 }}>{icon}</Box>
        <CardContent sx={{ p: 4 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#fff', mb: 1, fontFamily: 'Outfit', letterSpacing: '-0.02em' }}>{value}</Typography>
            <Typography variant="caption" sx={{ color: '#64748b', mb: 1, display: 'block', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{title}</Typography>
            <Typography variant="caption" sx={{ color, fontWeight: '900', letterSpacing: 0.5 }}>{change}</Typography>
        </CardContent>
    </Card>
);

const AppointmentRow = ({ name, time, status, statusColor, id, condition }) => {
    const navigate = useNavigate();
    const getColor = (c) => ({ error: '#ef4444', warning: '#f59e0b', success: '#10b981' }[c] || '#6366f1');
    return (
        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)', cursor: 'pointer' }, '&:last-child': { borderBottom: 'none' } }} onClick={() => id && navigate(`/patient/${id}`)}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 44, height: 44, background: 'linear-gradient(45deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 800, color: getColor(statusColor) }}>
                    {name.charAt(0)}
                </Avatar>
                <Box>
                    <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>{name}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>{condition}</Typography>
                </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
                <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 800 }}>{time}</Typography>
                <Chip size="small" label={status.toUpperCase()} sx={{ height: 18, fontSize: '0.65rem', mt: 0.5, fontWeight: 900, bgcolor: `${getColor(statusColor)}15`, color: getColor(statusColor), border: `1px solid ${getColor(statusColor)}33` }} />
            </Box>
        </Box>
    );
};

const QuickActionButton = ({ label, icon, onClick, color }) => (
    <Button fullWidth className="glass-card" onClick={onClick} sx={{ display: 'flex', flexDirection: 'column', py: 3, border: '1px solid rgba(255,255,255,0.03)', color: '#fff', background: 'rgba(255, 255, 255, 0.02)', transition: 'all 0.3s', borderRadius: '18px', '&:hover': { background: 'rgba(255, 255, 255, 0.05)', transform: 'translateY(-4px)', boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 15px ${color}22`, borderColor: `${color}44` } }}>
        <Box sx={{ color, mb: 1, display: 'flex', opacity: 0.8 }}>{React.cloneElement(icon, { sx: { fontSize: '1.8rem' } })}</Box>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', color: '#94a3b8' }}>{label}</Typography>
    </Button>
);

const MiniStat = ({ label, value, color = '#fff' }) => (
    <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color, fontFamily: 'Outfit' }}>{value}</Typography>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', mt: 0.5 }}>{label}</Typography>
    </Box>
);
