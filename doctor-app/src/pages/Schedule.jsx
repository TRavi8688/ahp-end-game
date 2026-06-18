import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, Grid, Card, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AddIcon from '@mui/icons-material/Add';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import { doctorService } from '../services/doctorService';

// FULL FIX (item #2 — "scheduling is not working"):
//   - GET /doctor/schedule and POST /doctor/schedule/provision didn't
//     exist on the backend at all (see backend patch). Now built.
//   - Raw fetch() against the old broken API_BASE_URL replaced with
//     doctorService, which uses the corrected .env value.
//   - The prev/next week arrow buttons were rendered but had NO onClick
//     handler at all — completely dead UI. Now wired to actually move
//     between weeks and refetch the real schedule for that week.

function getMondayOf(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

function toISODate(d) {
    return d.toISOString().split('T')[0];
}

export default function Schedule() {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState({
        'MON': [], 'TUE': [], 'WED': [], 'THU': [], 'FRI': []
    });
    const [weekAnchor, setWeekAnchor] = useState(() => getMondayOf(new Date()));
    const [loadingSchedule, setLoadingSchedule] = useState(true);

    // Provision slot dialog states
    const [openDialog, setOpenDialog] = useState(false);
    const [hospynId, setHospynId] = useState('');
    const [slotTime, setSlotTime] = useState(''); // YYYY-MM-DD HH:MM
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchSchedule = async (anchor) => {
        setLoadingSchedule(true);
        try {
            const data = await doctorService.getSchedule(toISODate(anchor));
            setAppointments(data || { MON: [], TUE: [], WED: [], THU: [], FRI: [] });
        } catch (err) {
            console.error("Failed to fetch schedule", err);
        } finally {
            setLoadingSchedule(false);
        }
    };

    useEffect(() => {
        fetchSchedule(weekAnchor);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekAnchor]);

    const goToPreviousWeek = () => {
        const prev = new Date(weekAnchor);
        prev.setDate(prev.getDate() - 7);
        setWeekAnchor(prev);
    };

    const goToNextWeek = () => {
        const next = new Date(weekAnchor);
        next.setDate(next.getDate() + 7);
        setWeekAnchor(next);
    };

    const handleProvisionSlot = async () => {
        if (!hospynId || !slotTime) {
            setErrorMsg("Hospyn ID and Date/Time are required.");
            return;
        }
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        // Reformat time from 'YYYY-MM-DDTHH:MM' (HTML input) to 'YYYY-MM-DD HH:MM'
        const formattedTime = slotTime.replace('T', ' ');

        try {
            const data = await doctorService.provisionSlot({
                hospyn_id: hospynId,
                scheduled_time: formattedTime
            });
            if (data && data.success) {
                setSuccessMsg("Clinical consultation slot successfully provisioned!");
                setHospynId('');
                setSlotTime('');
                fetchSchedule(weekAnchor);
                setTimeout(() => {
                    setOpenDialog(false);
                    setSuccessMsg('');
                }, 1500);
            } else {
                setErrorMsg(data?.message || "Failed to provision slot. Please check patient ID.");
            }
        } catch (e) {
            setErrorMsg(e?.response?.data?.message || e?.message || "Network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    // Dynamic weekly structure, anchored to the selected week (not always "today")
    const today = new Date();
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'].map((dayName, idx) => {
        const d = new Date(weekAnchor);
        d.setDate(weekAnchor.getDate() + idx);
        return {
            day: dayName,
            date: d.getDate().toString(),
            isToday: d.toDateString() === today.toDateString()
        };
    });

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const fridayDate = new Date(weekAnchor);
    fridayDate.setDate(weekAnchor.getDate() + 4);
    const weekLabel = `${monthNames[weekAnchor.getMonth()]} ${weekAnchor.getDate()} — ${monthNames[fridayDate.getMonth()]} ${fridayDate.getDate()}`;

    const getColorHex = (color) => {
        switch (color) {
            case 'teal': return '#0d9488';
            case 'red': return '#ef4444';
            case 'amber': return '#f59e0b';
            case 'purple': return '#8b5cf6';
            default: return '#cbd5e1';
        }
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', background: 'transparent' }}>

            {/* Header / Nav Hub */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Outfit', letterSpacing: '-1.5px', mb: 1 }}>Clinical Schedule</Typography>
                    <Typography variant="body1" sx={{ color: '#cbd5e1', fontWeight: 600, letterSpacing: 0.5 }}>SYNCHRONIZED PRACTITIONER FLOW</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, bgcolor: 'rgba(255,255,255,0.02)', p: 1, px: 3, borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <IconButton size="small" onClick={goToPreviousWeek} sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <ArrowBackIosNewIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', minWidth: 160, textAlign: 'center', fontFamily: 'Outfit' }}>
                        {weekLabel}
                    </Typography>
                    <IconButton size="small" onClick={goToNextWeek} sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <ArrowForwardIosIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => { setOpenDialog(true); setErrorMsg(''); setSuccessMsg(''); }}
                    sx={{
                        bgcolor: '#0d9488',
                        boxShadow: '0 8px 25px rgba(13, 148, 136, 0.3)',
                        '&:hover': { bgcolor: '#0f766e', transform: 'translateY(-2px)' },
                        textTransform: 'none',
                        fontWeight: 900,
                        borderRadius: '16px',
                        px: 4,
                        py: 1.5,
                        transition: 'all 0.2s'
                    }}
                >
                    Provision Slot
                </Button>
            </Box>

            {/* Calendar Intelligence Grid */}
            <Card className="glass-card" elevation={0} sx={{
                flex: 1,
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '32px',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'rgba(255,255,255,0.01)',
                backdropFilter: 'blur(40px)',
                overflow: 'hidden'
            }}>
                {loadingSchedule ? (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700 }}>Loading schedule…</Typography>
                    </Box>
                ) : (
                <Grid container sx={{ height: '100%' }}>
                    {days.map((dayObj, index) => (
                        <Grid item xs={12} md={2.4} key={dayObj.day} sx={{
                            borderRight: index < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.3s',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' }
                        }}>

                            {/* Column Cluster Header */}
                            <Box sx={{
                                p: 3,
                                textAlign: 'center',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                bgcolor: dayObj.isToday ? 'rgba(13, 148, 136, 0.05)' : 'transparent',
                                position: 'relative'
                            }}>
                                {dayObj.isToday && (
                                    <Box sx={{
                                        position: 'absolute', top: 0, left: 0, right: 0, height: 4, bgcolor: '#0d9488',
                                        boxShadow: '0 0 15px #0d9488'
                                    }} />
                                )}
                                <Typography variant="caption" sx={{ color: dayObj.isToday ? '#0d9488' : '#cbd5e1', fontWeight: 900, display: 'block', mb: 1, letterSpacing: 1.5 }}>
                                    {dayObj.day}
                                </Typography>
                                <Typography
                                    variant="h4"
                                    sx={{
                                        fontWeight: 900,
                                        color: dayObj.isToday ? '#fff' : '#cbd5e1',
                                        fontFamily: 'Outfit',
                                        transition: 'all 0.3s'
                                    }}
                                >
                                    {dayObj.date}
                                </Typography>
                            </Box>

                            {/* Column Node Body */}
                            <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
                                {appointments[dayObj.day] && appointments[dayObj.day].map((apt, i) => (
                                    <Box
                                        key={apt.id || i}
                                        onClick={() => apt.id ? navigate(`/patient/${apt.id}`) : null}
                                        sx={{
                                            p: 2.5,
                                            mb: 2,
                                            bgcolor: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            borderLeft: `4px solid ${getColorHex(apt.color)}`,
                                            borderRadius: '16px',
                                            cursor: apt.id ? 'pointer' : 'default',
                                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                            '&:hover': {
                                                bgcolor: 'rgba(255,255,255,0.04)',
                                                transform: apt.id ? 'scale(1.02)' : 'none',
                                                boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                                            }
                                        }}
                                    >
                                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#fff', mb: 1, fontFamily: 'Outfit' }}>
                                            {apt.patient || apt.title}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                                            <WatchLaterIcon sx={{ fontSize: 14, color: '#cbd5e1' }} />
                                            <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 700, fontFamily: 'monospace' }}>
                                                {apt.time}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: getColorHex(apt.color) }} />
                                            <Typography variant="caption" sx={{ color: getColorHex(apt.color), fontWeight: 900, fontSize: '0.65rem', letterSpacing: 0.5 }}>
                                                {(apt.type || '').toUpperCase()}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}
                                {(!appointments[dayObj.day] || appointments[dayObj.day].length === 0) && (
                                    <Box sx={{ py: 4, textAlign: 'center' }}>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.15)', fontWeight: 900, letterSpacing: 2 }}>NO SLOTS</Typography>
                                    </Box>
                                )}
                            </Box>
                        </Grid>
                    ))}
                </Grid>
                )}
            </Card>

            {/* Provision Slot Dialog Modal */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} PaperProps={{ sx: { bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, p: 2, minWidth: 400 } }}>
                <DialogTitle sx={{ color: '#fff', fontWeight: 'bold' }}>Provision Consultation Slot</DialogTitle>
                <DialogContent>
                    {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
                    {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Patient Hospyn ID"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={hospynId}
                        onChange={(e) => setHospynId(e.target.value)}
                        placeholder="e.g. HSP-8A9F3C1D"
                        sx={{ input: { color: '#fff' }, mb: 2 }}
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        margin="dense"
                        label="Date & Time"
                        type="datetime-local"
                        fullWidth
                        variant="outlined"
                        value={slotTime}
                        onChange={(e) => setSlotTime(e.target.value)}
                        sx={{ input: { color: '#fff' } }}
                        InputLabelProps={{ shrink: true }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpenDialog(false)} sx={{ color: '#cbd5e1' }}>Cancel</Button>
                    <Button
                        onClick={handleProvisionSlot}
                        variant="contained"
                        disabled={loading}
                        sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' }, fontWeight: 'bold' }}
                    >
                        {loading ? 'Provisioning...' : 'Provision Slot'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}
