import React from 'react';
import { Typography, Grid, Card, CardContent, Divider, Box, Button, Chip, Avatar, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Icons
import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import MedicationIcon from '@mui/icons-material/Medication';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { API_BASE_URL } from '../api';

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

    React.useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            try {
                // Fetch Patients
                const patientsRes = await fetch(`${API_BASE_URL}/doctor/my-patients`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (patientsRes.ok) setPatients(await patientsRes.json());

                // Fetch Profile
                const profileRes = await fetch(`${API_BASE_URL}/doctor/profile/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (profileRes.ok) setProfile(await profileRes.json());

                // Fetch Stats
                const statsRes = await fetch(`${API_BASE_URL}/doctor/stats`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (statsRes.ok) setStats(await statsRes.json());

            } catch (error) {
                console.error("Dashboard fetch error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // Derived Stats
    const appointmentsToday = stats.schedule_count;
    const pendingPrescriptions = stats.pending_rx_count;
    const urgentAlertsCount = stats.alerts_count;

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', px: 2, pt: 2 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography 
                    variant="h3" 
                    sx={{ 
                        fontWeight: 800, 
                        color: '#fff', 
                        fontFamily: 'Outfit', 
                        letterSpacing: '-0.02em',
                        background: 'linear-gradient(to right, #ffffff 0%, #94a3b8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}
                >
                    {profile ? `Good afternoon, Dr. ${profile.last_name}` : 'Welcome, Surgeon'}
                </Typography>
                <Typography variant="body1" sx={{ color: '#64748b', mt: 1, fontWeight: 500 }}>
                    <span style={{ color: '#0d9488', fontWeight: 700 }}>{appointmentsToday}</span> consultations scheduled today · 
                    <span style={{ color: '#6366f1', fontWeight: 700, marginLeft: '8px' }}>{pendingPrescriptions}</span> pending Rx · 
                    <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: '8px' }}>{urgentAlertsCount}</span> urgent alerts.
                </Typography>
            </Box>

            {/* Stats Row (4 cards) */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* Card 1 - Appointments */}
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Today's Appointments"
                        value={appointmentsToday}
                        change={appointmentsToday === 0 ? "No visits yet" : "▲ from yesterday"}
                        color="#0d9488" // Teal
                        icon={<EventIcon fontSize="large" sx={{ opacity: 0.2, color: '#0d9488' }} />}
                    />
                </Grid>
                {/* Card 2 - Active Patients */}
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="My Active Patients"
                        value={stats.patients_count}
                        change="+ on record"
                        color="#3b82f6" // Blue
                        icon={<PeopleIcon fontSize="large" sx={{ opacity: 0.2, color: '#3b82f6' }} />}
                    />
                </Grid>
                {/* Card 3 - Pending Prescriptions */}
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Pending Prescriptions"
                        value={pendingPrescriptions}
                        change={pendingPrescriptions === 0 ? "Up to date" : "Needs review"}
                        color="#f59e0b" // Amber
                        icon={<MedicationIcon fontSize="large" sx={{ opacity: 0.2, color: '#f59e0b' }} />}
                    />
                </Grid>
                {/* Card 4 - Urgent Alerts */}
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Urgent Alerts"
                        value={urgentAlertsCount}
                        change={urgentAlertsCount === 0 ? "All clear ✓" : "Requires attention"}
                        color={urgentAlertsCount === 0 ? "#10b981" : "#ef4444"} // Green or Red
                        icon={<WarningAmberIcon fontSize="large" sx={{ opacity: 0.2, color: urgentAlertsCount === 0 ? '#10b981' : '#ef4444' }} />}
                    />
                </Grid>
            </Grid>

            {/* Two-column section */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* Left Column: Today's Appointments */}
                <Grid item xs={12} md={7} lg={8}>
                    <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.05)', height: '100%', borderRadius: '24px' }}>
                        <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Outfit', letterSpacing: '-0.01em' }}>Recent Consultations</Typography>
                            <Button
                                endIcon={<ArrowForwardIosIcon sx={{ fontSize: 12 }} />}
                                onClick={() => navigate('/patients')}
                                sx={{ textTransform: 'none', fontWeight: 700, px: 2, borderRadius: '12px', color: '#0d9488' }}
                            >
                                Explorer All
                            </Button>
                        </Box>
                        <Box>
                            {isLoading ? (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <Typography color="#64748b" fontWeight={600}>Loading high-fidelity data...</Typography>
                                </Box>
                            ) : patients.length === 0 ? (
                                <Box sx={{ p: 4, textAlign: 'center' }}>
                                    <Typography color="#64748b" fontWeight={600}>No active clinical encounters recorded today.</Typography>
                                </Box>
                            ) : (
                                patients.slice(0, 5).map((p) => (
                                    <AppointmentRow
                                        key={p.hospyn_id}
                                        name={p.name}
                                        time={new Date(p.granted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        status={p.access_level === 'full' ? 'Active Access' : 'Restricted'}
                                        statusColor="success"
                                        id={p.hospyn_id}
                                        condition="Verified Patient"
                                    />
                                ))
                            )}
                        </Box>
                    </Card>
                </Grid>

                {/* Right Column: Quick Actions & Stats */}
                <Grid item xs={12} md={5} lg={4}>
                    {/* Quick Actions Card */}
                    <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.05)', mb: 3, borderRadius: '24px' }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Outfit', letterSpacing: '-0.01em' }}>Quick Actions</Typography>
                        </Box>
                        <Box sx={{ p: 2.5 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <QuickActionButton
                                        label="Scan QR"
                                        icon={<QrCodeScannerIcon />}
                                        onClick={onOpenScan}
                                        color="#0d9488"
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <QuickActionButton
                                        label="Write Rx"
                                        icon={<MedicationIcon />}
                                        onClick={() => navigate('/prescriptions')}
                                        color="#6366f1"
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <QuickActionButton
                                        label="Emergency"
                                        icon={<LocalHospitalIcon />}
                                        onClick={() => { }} 
                                        color="#ef4444"
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <QuickActionButton
                                        label="Vault"
                                        icon={<FolderSharedIcon />}
                                        onClick={() => navigate('/history')}
                                        color="#8b5cf6"
                                    />
                                </Grid>
                            </Grid>
                        </Box>
                    </Card>

                    {/* Today's Patient Stats Card */}
                    <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Outfit', letterSpacing: '-0.01em' }}>Real-time Stats</Typography>
                        </Box>
                        <Box sx={{ p: 3 }}>
                            <Grid container rowSpacing={3} columnSpacing={2}>
                                <Grid item xs={6}>
                                    <MiniStat label="Encounters" value={stats.patients_count} />
                                </Grid>
                                <Grid item xs={6}>
                                    <MiniStat label="Flags" value={stats.alerts_count} color={stats.alerts_count > 0 ? "#ef4444" : "#10b981"} />
                                </Grid>
                                <Grid item xs={6}>
                                    <MiniStat label="Authored Rx" value={stats.pending_rx_count} />
                                </Grid>
                                <Grid item xs={6}>
                                    <MiniStat label="Queue Status" value="Optimal" color="#0d9488" />
                                </Grid>
                            </Grid>
                        </Box>
                    </Card>
                </Grid>
            </Grid>

            {/* Urgent Alert Panel (Full Width) */}
            {urgentAlertsCount > 0 && (
                <Card elevation={0} sx={{ border: '1px solid #fca5a5', bgcolor: '#fef2f2', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3, flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1, minWidth: 300 }}>
                            <Box sx={{ p: 1, bgcolor: '#fee2e2', borderRadius: '50%', display: 'flex' }}>
                                <WarningAmberIcon sx={{ color: '#dc2626', fontSize: 32 }} />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight="bold" sx={{ color: '#b91c1c' }}>
                                    Drug Interaction Alert — Rahul Sharma
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#7f1d1d', mt: 0.5 }}>
                                    New prescription includes Amoxicillin. Patient's Hospyn profile shows a Severe allergy to Penicillin. This requires immediate review.
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                            <Button variant="outlined" color="error" sx={{ bgcolor: 'white' }}>
                                Flag & Hold
                            </Button>
                            <Button variant="contained" color="error" onClick={() => navigate('/patient/Hospyn-IN-9284-7731')}>
                                View Patient
                            </Button>
                        </Box>
                    </Box>
                </Card>
            )}
        </Box>
    );
}

// Subcomponents

const StatCard = ({ title, value, change, color, icon }) => (
    <Card
        className="glass-card"
        elevation={0}
        sx={{
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'rgba(255, 255, 255, 0.02)',
            '&:hover': {
                transform: 'translateY(-8px)',
                background: 'rgba(255, 255, 255, 0.05)',
                boxShadow: `0 20px 40px -15px rgba(0, 0, 0, 0.8), 0 0 20px ${color}22`,
                '& .stat-icon': {
                    transform: 'scale(1.2) rotate(-5deg)',
                    opacity: 0.5
                }
            }
        }}
    >
        <Box className="stat-icon" sx={{ position: 'absolute', top: 16, right: 16, transition: 'all 0.4s', opacity: 0.15 }}>
            {icon}
        </Box>
        <CardContent sx={{ p: 4 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#fff', mb: 1, fontFamily: 'Outfit', letterSpacing: '-0.02em' }}>{value}</Typography>
            <Typography variant="caption" sx={{ color: '#64748b', mb: 1, display: 'block', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{title}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="caption" sx={{ color: color, fontWeight: '900', letterSpacing: 0.5 }}>{change}</Typography>
            </Box>
        </CardContent>
    </Card>
);

const AppointmentRow = ({ name, time, status, statusColor, id, condition }) => {
    const navigate = useNavigate();

    const getStatusColor = (color) => {
        switch (color) {
            case 'error': return '#ef4444';
            case 'warning': return '#f59e0b';
            case 'success': return '#10b981';
            default: return '#6366f1';
        }
    };

    return (
        <Box
            sx={{
                p: 2.5,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
                '&:hover': { 
                    bgcolor: 'rgba(255,255,255,0.02)', 
                    cursor: 'pointer',
                    transform: 'scale(1.005)'
                },
                '&:last-child': { borderBottom: 'none' }
            }}
            onClick={() => navigate(`/patient/${id}`)}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar 
                    sx={{ 
                        width: 44, 
                        height: 44, 
                        background: 'linear-gradient(45deg, #1e293b 0%, #0f172a 100%)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontWeight: 800,
                        color: getStatusColor(statusColor)
                    }}
                >
                    {name.charAt(0)}
                </Avatar>
                <Box>
                    <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>{name}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                        {condition} · <span style={{ color: '#94a3b8' }}>{id}</span>
                    </Typography>
                </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
                <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 800 }}>{time}</Typography>
                <Chip 
                    size="small" 
                    label={status.toUpperCase()} 
                    sx={{ 
                        height: 18, 
                        fontSize: '0.65rem', 
                        mt: 0.5, 
                        fontWeight: 900,
                        bgcolor: `${getStatusColor(statusColor)}15`,
                        color: getStatusColor(statusColor),
                        border: `1px solid ${getStatusColor(statusColor)}33`
                    }} 
                />
            </Box>
        </Box>
    );
};

const QuickActionButton = ({ label, icon, onClick, color }) => (
    <Button
        fullWidth
        className="glass-card"
        onClick={onClick}
        sx={{
            display: 'flex',
            flexDirection: 'column',
            py: 3,
            border: '1px solid rgba(255,255,255,0.03)',
            color: '#fff',
            background: 'rgba(255, 255, 255, 0.02)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            borderRadius: '18px',
            '&:hover': {
                background: 'rgba(255, 255, 255, 0.05)',
                transform: 'translateY(-4px)',
                boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 15px ${color}22`,
                borderColor: `${color}44`
            }
        }}
    >
        <Box sx={{ color: color, mb: 1, display: 'flex', opacity: 0.8 }}>
            {React.cloneElement(icon, { sx: { fontSize: '1.8rem' } })}
        </Box>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', color: '#94a3b8' }}>{label}</Typography>
    </Button>
);

const MiniStat = ({ label, value, color = '#fff' }) => (
    <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: color, fontFamily: 'Outfit' }}>{value}</Typography>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', mt: 0.5 }}>{label}</Typography>
    </Box>
);
