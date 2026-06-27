import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, Grid, Button, Chip, CircularProgress,
    TextField, Dialog, DialogTitle, DialogContent, DialogActions,
    Alert, Snackbar, IconButton, Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import { clinicalService } from '../services/clinicalService';

const LEAVE_TYPES = ['Day Off', 'Half Day', 'Emergency Leave', 'Conference / CME', 'Personal', 'Vacation'];

const STATUS_CONFIG = {
    approved: { label: 'APPROVED', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
    pending: { label: 'PENDING', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
    rejected: { label: 'REJECTED', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
};

// FIXED: this page used to fall back to three hardcoded fake leave entries
// (MOCK_LEAVES) any time the real fetch failed, and on a failed submit it
// would optimistically insert a fake "pending" leave into local state and
// tell the doctor it succeeded. The backend's GET/POST/DELETE
// /doctor/leave endpoints (doctor_schedule_routes.py) are fully
// implemented and match what clinicalService already sends — there's no
// reason this should ever need to fake success. Surfacing real errors is
// safer than a doctor believing a leave request went through when it
// didn't.
export default function LeaveManagement() {
    const [leaves, setLeaves] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [cancellingId, setCancellingId] = useState(null);
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

    const [form, setForm] = useState({
        leave_type: 'Day Off',
        start_date: '',
        end_date: '',
        reason: '',
    });
    const [formError, setFormError] = useState('');

    const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });

    const fetchLeaves = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await clinicalService.getLeaveHistory();
            setLeaves(Array.isArray(data) ? data : data?.leaves || []);
            setLoadError(null);
        } catch (error) {
            console.error('Leave fetch error:', error);
            setLoadError(error.message || 'Could not load leave requests.');
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => { fetchLeaves(); }, []);

    const handleOpenDialog = () => {
        setForm({ leave_type: 'Day Off', start_date: '', end_date: '', reason: '' });
        setFormError('');
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.start_date) { setFormError('Start date is required.'); return; }
        if (!form.end_date) { setFormError('End date is required.'); return; }
        if (new Date(form.end_date) < new Date(form.start_date)) { setFormError('End date cannot be before start date.'); return; }

        setSubmitting(true);
        setFormError('');
        try {
            await clinicalService.markLeave({
                leave_type: form.leave_type,
                start_date: form.start_date,
                end_date: form.end_date,
                reason: form.reason || form.leave_type,
            });
            showToast('Leave request submitted successfully!');
            setDialogOpen(false);
            fetchLeaves(true);
        } catch (error) {
            console.error('Submit leave error:', error);
            // FIXED: previously caught this, silently inserted a fake
            // local "pending" leave, and told the doctor it succeeded —
            // even though nothing was actually saved server-side. Show
            // the real error in the dialog instead so they can retry.
            setFormError(error.message || 'Failed to submit leave request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async (leaveId) => {
        setCancellingId(leaveId);
        try {
            await clinicalService.cancelLeave(leaveId);
            showToast('Leave cancelled successfully.');
            fetchLeaves(true);
        } catch (error) {
            // FIXED: previously removed the leave from local state and
            // claimed success even when the DELETE call failed, which
            // would make a still-active leave request silently vanish
            // from the doctor's view while remaining pending server-side.
            console.error('Cancel leave error:', error);
            showToast(error.message || 'Failed to cancel leave. Please try again.', 'error');
        } finally {
            setCancellingId(null);
        }
    };

    const approvedCount = leaves.filter(l => l.status === 'approved').length;
    const pendingCount = leaves.filter(l => l.status === 'pending').length;
    const totalDays = leaves.filter(l => l.status !== 'rejected').reduce((acc, l) => {
        const diff = Math.ceil((new Date(l.end_date) - new Date(l.start_date)) / (1000 * 60 * 60 * 24)) + 1;
        return acc + diff;
    }, 0);

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, md: 4 }, pt: 4, pb: 8 }}>
            {/* Header */}
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Syne', letterSpacing: '-0.04em', mb: 1 }}>
                        Leave Management
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Manage your days off and availability
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}
                    sx={{ bgcolor: '#0d9488', fontWeight: 900, borderRadius: '14px', px: 4, py: 1.5, boxShadow: '0 8px 25px rgba(13,148,136,0.35)', '&:hover': { bgcolor: '#0f766e' } }}>
                    Request Leave
                </Button>
            </Box>

            {/* Stats */}
            <Grid container spacing={3} sx={{ mb: 6 }}>
                {[
                    { label: 'Approved', value: approvedCount, color: '#10b981', bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.15)', icon: <CheckCircleIcon /> },
                    { label: 'Pending', value: pendingCount, color: '#f59e0b', bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.15)', icon: <PendingIcon /> },
                    { label: 'Total Days', value: totalDays, color: '#6366f1', bg: 'rgba(99,102,241,0.05)', border: 'rgba(99,102,241,0.15)', icon: <EventBusyIcon /> },
                ].map(s => (
                    <Grid item xs={12} sm={4} key={s.label}>
                        <Card elevation={0} sx={{ p: 3, bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: '20px', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Box sx={{ p: 1.5, bgcolor: `${s.color}20`, borderRadius: '14px', color: s.color }}>{s.icon}</Box>
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Outfit' }}>{s.value}</Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</Typography>
                            </Box>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Leave List */}
            <Card elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', overflow: 'hidden' }}>
                <Box sx={{ p: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Syne' }}>Leave Requests</Typography>
                </Box>

                {isLoading ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}><CircularProgress sx={{ color: '#0d9488' }} /></Box>
                ) : loadError ? (
                    <Box sx={{ p: 4 }}>
                        <Alert severity="error" sx={{ borderRadius: 2 }}>{loadError}</Alert>
                    </Box>
                ) : leaves.length === 0 ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}>
                        <EventBusyIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#64748b', fontWeight: 700 }}>No leave requests</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', mt: 1 }}>Click "Request Leave" to add one.</Typography>
                    </Box>
                ) : (
                    leaves.map((leave, index) => {
                        const statusCfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
                        const startDate = new Date(leave.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        const endDate = new Date(leave.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        const days = Math.ceil((new Date(leave.end_date) - new Date(leave.start_date)) / (1000 * 60 * 60 * 24)) + 1;
                        return (
                            <Box key={leave.id} sx={{ p: 3, borderBottom: index < leaves.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                                {/* Icon */}
                                <Box sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: statusCfg.bg, border: `1px solid ${statusCfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <EventBusyIcon sx={{ color: statusCfg.color, fontSize: 22 }} />
                                </Box>
                                {/* Info */}
                                <Box sx={{ flex: 1, minWidth: 200 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5, flexWrap: 'wrap' }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff' }}>{leave.leave_type}</Typography>
                                        <Chip size="small" label={statusCfg.label} sx={{ bgcolor: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`, fontWeight: 900, fontSize: '0.65rem' }} />
                                    </Box>
                                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                                        {startDate} {leave.start_date !== leave.end_date ? `→ ${endDate}` : ''} · {days} day{days > 1 ? 's' : ''}
                                    </Typography>
                                    {leave.reason && (
                                        <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>{leave.reason}</Typography>
                                    )}
                                </Box>
                                {/* Cancel button (only for pending) */}
                                {leave.status === 'pending' && (
                                    <IconButton onClick={() => handleCancel(leave.id)} disabled={cancellingId === leave.id}
                                        sx={{ color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)', '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' }, borderRadius: '12px' }}>
                                        {cancellingId === leave.id ? <CircularProgress size={18} sx={{ color: '#ef4444' }} /> : <DeleteIcon />}
                                    </IconButton>
                                )}
                            </Box>
                        );
                    })
                )}
            </Card>

            {/* Request Leave Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
                PaperProps={{ sx: { bgcolor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', p: 1 } }}>
                <DialogTitle sx={{ color: '#fff', fontWeight: 900, fontFamily: 'Syne', fontSize: '1.3rem' }}>Request Leave</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{formError}</Alert>}

                    {/* Leave Type */}
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: 1, display: 'block', mb: 1, mt: 1 }}>LEAVE TYPE</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                        {LEAVE_TYPES.map(t => (
                            <Chip key={t} label={t} onClick={() => setForm(f => ({ ...f, leave_type: t }))} clickable
                                sx={{
                                    bgcolor: form.leave_type === t ? 'rgba(13,148,136,0.2)' : 'rgba(255,255,255,0.04)',
                                    color: form.leave_type === t ? '#0d9488' : '#94a3b8',
                                    border: `1px solid ${form.leave_type === t ? 'rgba(13,148,136,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                    fontWeight: 700,
                                    '&:hover': { bgcolor: 'rgba(13,148,136,0.1)' }
                                }} />
                        ))}
                    </Box>

                    {/* Dates */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6}>
                            <TextField fullWidth type="date" label="Start Date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                                InputLabelProps={{ shrink: true, style: { color: '#64748b' } }}
                                inputProps={{ style: { color: 'white' }, min: new Date().toISOString().split('T')[0] }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' } } }} />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField fullWidth type="date" label="End Date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                                InputLabelProps={{ shrink: true, style: { color: '#64748b' } }}
                                inputProps={{ style: { color: 'white' }, min: form.start_date || new Date().toISOString().split('T')[0] }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' } } }} />
                        </Grid>
                    </Grid>

                    {/* Reason */}
                    <TextField fullWidth multiline rows={3} label="Reason (optional)" placeholder="e.g. Annual family vacation" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                        InputLabelProps={{ style: { color: '#64748b' } }}
                        sx={{ '& .MuiOutlinedInput-root': { color: 'white', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' } } }} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, gap: 2 }}>
                    <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748b', fontWeight: 700, borderRadius: '12px', px: 3 }}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={submitting}
                        sx={{ bgcolor: '#0d9488', fontWeight: 900, borderRadius: '12px', px: 4, '&:hover': { bgcolor: '#0f766e' } }}>
                        {submitting ? <CircularProgress size={20} color="inherit" /> : 'Submit Request'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setToast(p => ({ ...p, open: false }))} severity={toast.severity} sx={{ width: '100%', fontWeight: 'bold' }}>{toast.message}</Alert>
            </Snackbar>
        </Box>
    );
}
