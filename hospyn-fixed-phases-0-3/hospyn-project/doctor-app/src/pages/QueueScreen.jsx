import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Button, Chip, Avatar, Card, Grid,
    CircularProgress, Divider, IconButton, Tooltip, Snackbar, Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { clinicalService } from '../services/clinicalService';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';

const STATUS_CONFIG = {
    waiting: { label: 'WAITING', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: <HourglassEmptyIcon sx={{ fontSize: 14 }} /> },
    waiting_doctor: { label: 'WAITING', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: <HourglassEmptyIcon sx={{ fontSize: 14 }} /> },
    in_consultation: { label: 'IN CONSULT', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: <MedicalServicesIcon sx={{ fontSize: 14 }} /> },
    with_doctor: { label: 'IN CONSULT', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: <MedicalServicesIcon sx={{ fontSize: 14 }} /> },
    completed: { label: 'DONE', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
    done: { label: 'DONE', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
};

export default function QueueScreen() {
    const navigate = useNavigate();
    const { lastMessage, isConnected } = useSocket();

    const [queue, setQueue] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [queueStarted, setQueueStarted] = useState(false);
    const [startingQueue, setStartingQueue] = useState(false);
    const [callingNext, setCallingNext] = useState(false);
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

    const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });

    const fetchQueue = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await clinicalService.getActiveQueue();
            const queueList = data?.data?.queue || data?.queue || data || [];
            setQueue(Array.isArray(queueList) ? queueList : []);
            // If there are patients, session is likely already started
            if (queueList.length > 0) setQueueStarted(true);
        } catch (error) {
            console.error('Queue fetch error:', error);
            if (!silent) setQueue([]);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    // Live WebSocket updates
    useEffect(() => {
        if (!lastMessage) return;
        const liveEvents = ['queue_update', 'patient_called', 'token_advanced', 'patient_arrived', 'consultation_ended'];
        if (liveEvents.includes(lastMessage.type)) {
            fetchQueue(true);
        }
    }, [lastMessage, fetchQueue]);

    const handleStartQueue = async () => {
        setStartingQueue(true);
        try {
            await clinicalService.startQueueSession();
            setQueueStarted(true);
            showToast('Queue session started! Ready to see patients.');
            fetchQueue(true);
        } catch (error) {
            console.error('Start queue error:', error);
            // Still mark as started — backend may already have a session
            setQueueStarted(true);
            showToast('Session activated.', 'info');
        } finally {
            setStartingQueue(false);
        }
    };

    const handleCallNext = async () => {
        setCallingNext(true);
        try {
            const result = await clinicalService.callNextPatient();
            showToast('Next patient called! Please ask them to enter.');
            fetchQueue(true);
        } catch (error) {
            console.error('Call next error:', error);
            showToast(error.message || 'Failed to call next patient.', 'error');
        } finally {
            setCallingNext(false);
        }
    };

    const waitingCount = queue.filter(p => ['waiting', 'waiting_doctor'].includes(p.queue_state || p.status)).length;
    const inConsultCount = queue.filter(p => ['in_consultation', 'with_doctor'].includes(p.queue_state || p.status)).length;
    const doneCount = queue.filter(p => ['completed', 'done'].includes(p.queue_state || p.status)).length;
    const currentPatient = queue.find(p => ['in_consultation', 'with_doctor'].includes(p.queue_state || p.status));
    const nextPatient = queue.find(p => ['waiting', 'waiting_doctor'].includes(p.queue_state || p.status));

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 4 }, pt: 4, pb: 8 }}>
            {/* Header */}
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Syne', letterSpacing: '-0.04em', mb: 1 }}>
                        Live Queue
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isConnected ? '#10b981' : '#ef4444', boxShadow: isConnected ? '0 0 10px #10b981' : 'none' }} />
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                            {isConnected ? 'Live sync active' : 'Reconnecting...'}
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Tooltip title="Refresh queue">
                        <IconButton onClick={() => fetchQueue(false)} sx={{ color: '#64748b', bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    {!queueStarted ? (
                        <Button variant="contained" startIcon={startingQueue ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                            onClick={handleStartQueue} disabled={startingQueue}
                            sx={{ bgcolor: '#0d9488', fontWeight: 900, borderRadius: '14px', px: 4, py: 1.5, boxShadow: '0 8px 25px rgba(13,148,136,0.35)', '&:hover': { bgcolor: '#0f766e' } }}>
                            {startingQueue ? 'Starting...' : 'Start Queue Session'}
                        </Button>
                    ) : (
                        <Button variant="contained" startIcon={callingNext ? <CircularProgress size={18} color="inherit" /> : <SkipNextIcon />}
                            onClick={handleCallNext} disabled={callingNext || waitingCount === 0}
                            sx={{ bgcolor: '#6366f1', fontWeight: 900, borderRadius: '14px', px: 4, py: 1.5, boxShadow: '0 8px 25px rgba(99,102,241,0.35)', '&:hover': { bgcolor: '#4f46e5' } }}>
                            {callingNext ? 'Calling...' : 'Call Next Patient'}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Stats Row */}
            <Grid container spacing={3} sx={{ mb: 6 }}>
                {[
                    { label: 'Waiting', value: waitingCount, color: '#f59e0b', bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.2)' },
                    { label: 'In Consultation', value: inConsultCount, color: '#10b981', bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.2)' },
                    { label: 'Completed Today', value: doneCount, color: '#6366f1', bg: 'rgba(99,102,241,0.05)', border: 'rgba(99,102,241,0.2)' },
                    { label: 'Total', value: queue.length, color: '#0ea5e9', bg: 'rgba(14,165,233,0.05)', border: 'rgba(14,165,233,0.2)' },
                ].map(s => (
                    <Grid item xs={6} md={3} key={s.label}>
                        <Card elevation={0} sx={{ p: 3, bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: '20px', textAlign: 'center' }}>
                            <Typography variant="h3" sx={{ fontWeight: 900, color: s.color, fontFamily: 'Outfit', mb: 1 }}>{s.value}</Typography>
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</Typography>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Current + Next Patient Spotlight */}
            {queueStarted && (currentPatient || nextPatient) && (
                <Grid container spacing={3} sx={{ mb: 6 }}>
                    {currentPatient && (
                        <Grid item xs={12} md={6}>
                            <Card elevation={0} sx={{ p: 4, bgcolor: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '24px' }}>
                                <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 900, letterSpacing: 2, display: 'block', mb: 3 }}>CURRENTLY WITH DOCTOR</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: '1.8rem', fontWeight: 900, border: '2px solid rgba(16,185,129,0.3)' }}>
                                        {(currentPatient.full_name || currentPatient.first_name || 'P')[0]}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#fff', mb: 0.5 }}>
                                            {currentPatient.full_name || currentPatient.first_name || 'Patient'}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                                            Token #{currentPatient.queue_number || currentPatient.token_number} · {currentPatient.reason_for_visit || currentPatient.chief_complaint || 'General consultation'}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button fullWidth variant="contained" sx={{ mt: 3, bgcolor: '#10b981', borderRadius: '14px', fontWeight: 900, '&:hover': { bgcolor: '#059669' } }}
                                    onClick={() => navigate(`/patient/${currentPatient.patient_id || currentPatient.id}`)}>
                                    Open Patient File
                                </Button>
                            </Card>
                        </Grid>
                    )}
                    {nextPatient && (
                        <Grid item xs={12} md={6}>
                            <Card elevation={0} sx={{ p: 4, bgcolor: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '24px' }}>
                                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 900, letterSpacing: 2, display: 'block', mb: 3 }}>UP NEXT</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: '1.8rem', fontWeight: 900, border: '2px solid rgba(245,158,11,0.3)' }}>
                                        {(nextPatient.full_name || nextPatient.first_name || 'P')[0]}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#fff', mb: 0.5 }}>
                                            {nextPatient.full_name || nextPatient.first_name || 'Patient'}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                                            Token #{nextPatient.queue_number || nextPatient.token_number} · {nextPatient.reason_for_visit || nextPatient.chief_complaint || 'General consultation'}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button fullWidth variant="outlined" sx={{ mt: 3, borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: '14px', fontWeight: 900 }}
                                    onClick={handleCallNext} disabled={callingNext}>
                                    {callingNext ? 'Calling...' : 'Call This Patient'}
                                </Button>
                            </Card>
                        </Grid>
                    )}
                </Grid>
            )}

            {/* Full Queue List */}
            <Card elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', overflow: 'hidden' }}>
                <Box sx={{ p: 4, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Syne' }}>Full Queue</Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', fontFamily: 'Space Mono' }}>{queue.length} PATIENTS</Typography>
                </Box>

                {isLoading ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}>
                        <CircularProgress sx={{ color: '#0d9488' }} />
                        <Typography sx={{ mt: 2, color: '#64748b' }}>Loading queue...</Typography>
                    </Box>
                ) : queue.length === 0 ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}>
                        <PersonIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#64748b', fontWeight: 700, mb: 1 }}>No patients in queue</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                            {queueStarted ? 'The waiting room is empty. Great work!' : 'Start your queue session to begin seeing patients.'}
                        </Typography>
                    </Box>
                ) : (
                    queue.map((patient, index) => {
                        const state = patient.queue_state || patient.status || 'waiting';
                        const statusCfg = STATUS_CONFIG[state] || STATUS_CONFIG.waiting;
                        const patientId = patient.patient_id || patient.id;
                        return (
                            <Box key={patient.id || index} sx={{ p: 3, borderBottom: index < queue.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)', cursor: 'pointer' } }}
                                onClick={() => patientId && navigate(`/patient/${patientId}`)}>
                                {/* Token Number */}
                                <Box sx={{ width: 52, height: 52, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 900, color: statusCfg.color, fontFamily: 'Space Mono' }}>
                                        {patient.queue_number || patient.token_number || index + 1}
                                    </Typography>
                                </Box>
                                {/* Avatar */}
                                <Avatar sx={{ width: 44, height: 44, bgcolor: `${statusCfg.color}20`, color: statusCfg.color, fontWeight: 900, border: `1px solid ${statusCfg.color}30`, flexShrink: 0 }}>
                                    {(patient.full_name || patient.first_name || 'P')[0]}
                                </Avatar>
                                {/* Info */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', mb: 0.5 }} noWrap>
                                        {patient.full_name || patient.first_name || 'Unknown Patient'}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                                            {patient.reason_for_visit || patient.chief_complaint || 'General consultation'}
                                        </Typography>
                                        {patient.hospyn_id && (
                                            <Typography variant="caption" sx={{ color: '#334155', fontFamily: 'monospace' }}>
                                                {patient.hospyn_id}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                                {/* Wait time */}
                                {patient.wait_minutes != null && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                        <AccessTimeIcon sx={{ fontSize: 14, color: '#64748b' }} />
                                        <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'Space Mono' }}>
                                            {patient.wait_minutes}m
                                        </Typography>
                                    </Box>
                                )}
                                {/* Status */}
                                <Chip size="small" icon={statusCfg.icon} label={statusCfg.label}
                                    sx={{ bgcolor: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`, fontWeight: 900, fontSize: '0.65rem', flexShrink: 0, '& .MuiChip-icon': { color: statusCfg.color } }} />
                            </Box>
                        );
                    })
                )}
            </Card>

            <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setToast(p => ({ ...p, open: false }))} severity={toast.severity} sx={{ width: '100%', fontWeight: 'bold' }}>{toast.message}</Alert>
            </Snackbar>
        </Box>
    );
}
