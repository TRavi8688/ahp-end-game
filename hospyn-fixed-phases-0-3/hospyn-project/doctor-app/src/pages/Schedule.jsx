import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, Grid, Card, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AddIcon from '@mui/icons-material/Add';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import { API_BASE_URL } from '../api';

export default function Schedule() {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState({
        'MON': [],
        'TUE': [],
        'WED': [],
        'THU': [],
        'FRI': []
    });
    
    // Provision slot dialog states
    const [openDialog, setOpenDialog] = useState(false);
    const [hospynId, setHospynId] = useState('');
    const [slotTime, setSlotTime] = useState(''); // YYYY-MM-DD HH:MM
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchSchedule = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/doctor/schedule`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAppointments(data);
            }
        } catch (err) {
            console.error("Failed to fetch schedule", err);
        }
    };

    useEffect(() => {
        fetchSchedule();
    }, []);

    const handleProvisionSlot = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
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
            const res = await fetch(`${API_BASE_URL}/doctor/schedule/provision`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    hospyn_id: hospynId,
                    scheduled_time: formattedTime
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSuccessMsg("Clinical consultation slot successfully provisioned!");
                setHospynId('');
                setSlotTime('');
                fetchSchedule();
                setTimeout(() => {
                    setOpenDialog(false);
                    setSuccessMsg('');
                }, 1500);
            } else {
                setErrorMsg(data.detail || "Failed to provision slot. Please check patient ID.");
            }
        } catch (e) {
            setErrorMsg("Network error occurred.");
        } finally {
            setLoading(false);
        }
    };

    // Dynamic weekly structure
    const today = new Date();
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'].map((dayName, idx) => {
        const d = new Date(today);
        const dayOffset = idx - ((today.getDay() + 6) % 7); // Calculate diff from Monday
        d.setDate(today.getDate() + dayOffset);
        return {
            day: dayName,
            date: d.getDate().toString(),
            isToday: d.toDateString() === today.toDateString()
        };
    });

    // Compute dynamic week label from the days array
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const mondayDate = new Date(today);
    mondayDate.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const fridayDate = new Date(mondayDate);
    fridayDate.setDate(mondayDate.getDate() + 4);
    const weekLabel = `${monthNames[mondayDate.getMonth()]} ${mondayDate.getDate()} — ${monthNames[fridayDate.getMonth()]} ${fridayDate.getDate()}`;

    const getColorHex = (color) => {
        switch (color) {
            case 'teal': return '#0d9488';
            case 'red': return '#ef4444';
            case 'amber': return '#f59e0b';
            case 'purple': return '#8b5cf6';
            default: return '#e5e7eb';
        }
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', background: 'transparent' }}>

            {/* Header / Nav Hub */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Outfit', letterSpacing: '-1.5px', mb: 1 }}>Clinical Schedule</Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600, letterSpacing: 0.5 }}>SYNCHRONIZED PRACTITIONER FLOW</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, bgcolor: 'rgba(255,255,255,0.02)', p: 1, px: 3, borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <IconButton size="small" sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <ArrowBackIosNewIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', minWidth: 160, textAlign: 'center', fontFamily: 'Outfit' }}>
                        {weekLabel}
                    </Typography>
                    <IconButton size="small" sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
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
                                <Typography variant="caption" sx={{ color: dayObj.isToday ? '#0d9488' : '#64748b', fontWeight: 900, display: 'block', mb: 1, letterSpacing: 1.5 }}>
                                    {dayObj.day}
                                </Typography>
                                <Typography
                                    variant="h4"
                                    sx={{
                                        fontWeight: 900,
                                        color: dayObj.isToday ? '#fff' : '#475569',
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
                                        key={i}
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
                                            <WatchLaterIcon sx={{ fontSize: 14, color: '#64748b' }} />
                                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
                                                {apt.time}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: getColorHex(apt.color) }} />
                                            <Typography variant="caption" sx={{ color: getColorHex(apt.color), fontWeight: 900, fontSize: '0.65rem', letterSpacing: 0.5 }}>
                                                {apt.type.toUpperCase()}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}
                                {(!appointments[dayObj.day] || appointments[dayObj.day].length === 0) && (
                                    <Box sx={{ py: 4, textAlign: 'center' }}>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.02)', fontWeight: 900, letterSpacing: 2 }}>VAULT EMPTY</Typography>
                                    </Box>
                                )}
                            </Box>
                        </Grid>
                    ))}
                </Grid>
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
                        placeholder="e.g. Hospyn-8A9F3C1D"
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
                    <Button onClick={() => setOpenDialog(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
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
