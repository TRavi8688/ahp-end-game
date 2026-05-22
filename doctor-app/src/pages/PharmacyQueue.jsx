import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Chip, IconButton, Button, Divider, CircularProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, Switch, Alert, Snackbar,
    Tooltip, Avatar
} from '@mui/material';
import {
    LocalPharmacy, CheckCircle, Cancel, Refresh, MedicalServices,
    AccessTime, Person, Business, ContentCopy, ExpandMore, ExpandLess
} from '@mui/icons-material';
import ApiService from '../utils/ApiService';

const statusColors = {
    pending: { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', border: 'rgba(245, 158, 11, 0.2)' },
    fulfilled: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: 'rgba(16, 185, 129, 0.2)' },
    rejected: { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'rgba(239, 68, 68, 0.2)' }
};

export default function PharmacyQueue() {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dispensingId, setDispensingId] = useState(null);
    const [medToggles, setMedToggles] = useState({});
    const [processing, setProcessing] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [expandedId, setExpandedId] = useState(null);

    const fetchQueue = useCallback(async () => {
        setLoading(true);
        try {
            const data = await ApiService.get('/clinical/prescriptions');
            const pending = Array.isArray(data)
                ? data.filter(p => p.status === 'pending')
                : [];
            setPrescriptions(pending);
        } catch (error) {
            console.error('Failed to fetch pharmacy queue:', error);
            setPrescriptions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchQueue(); }, [fetchQueue]);

    const openDispenseDialog = (prescription) => {
        setDispensingId(prescription.id);
        const toggles = {};
        (prescription.medications || []).forEach(med => {
            toggles[med.name] = 'accept';
        });
        setMedToggles(toggles);
    };

    const handleToggle = (medName) => {
        setMedToggles(prev => ({
            ...prev,
            [medName]: prev[medName] === 'accept' ? 'decline' : 'accept'
        }));
    };

    const handleDispense = async () => {
        if (!dispensingId) return;
        setProcessing(true);
        try {
            const items = Object.entries(medToggles).map(([name, action]) => ({ name, action }));
            const result = await ApiService.post(`/clinical/prescriptions/${dispensingId}/dispense_partial`, { items });
            
            const accepted = items.filter(i => i.action === 'accept').length;
            const declined = items.filter(i => i.action === 'decline').length;
            
            let message = '';
            if (declined === 0) {
                message = `All ${accepted} medicines dispensed successfully! Patient notified.`;
            } else {
                message = `${accepted} medicine(s) dispensed. ${declined} remaining medicine(s) auto-transferred to a new prescription for the patient.`;
            }
            
            setSnackbar({ open: true, message, severity: 'success' });
            setDispensingId(null);
            fetchQueue();
        } catch (error) {
            setSnackbar({ open: true, message: 'Failed to dispense: ' + (error?.response?.data?.detail || error.message), severity: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const handleDeclineAll = async (prescriptionId) => {
        setProcessing(true);
        try {
            const prescription = prescriptions.find(p => p.id === prescriptionId);
            if (!prescription) return;
            const items = (prescription.medications || []).map(med => ({ name: med.name, action: 'decline' }));
            await ApiService.post(`/clinical/prescriptions/${prescriptionId}/dispense_partial`, { items });
            setSnackbar({ open: true, message: 'Prescription declined. Patient notified with remaining medicines.', severity: 'info' });
            fetchQueue();
        } catch (error) {
            setSnackbar({ open: true, message: 'Failed to decline.', severity: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const formatDate = (dateStr) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        } catch { return 'N/A'; }
    };

    const dispensingPrescription = prescriptions.find(p => p.id === dispensingId);

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                        <LocalPharmacy sx={{ mr: 1, verticalAlign: 'middle', color: '#0D9488' }} />
                        Pharmacy Queue
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
                        Incoming prescriptions from patients in the Hospyn network
                    </Typography>
                </Box>
                <Tooltip title="Refresh Queue">
                    <IconButton onClick={fetchQueue} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 }}>
                        <Refresh />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Stats Row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 4 }}>
                <Paper className="glass-card" sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#F59E0B', letterSpacing: 2 }}>PENDING</Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#F59E0B', mt: 1 }}>
                        {prescriptions.length}
                    </Typography>
                </Paper>
                <Paper className="glass-card" sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#10B981', letterSpacing: 2 }}>DISPENSED TODAY</Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#10B981', mt: 1 }}>—</Typography>
                </Paper>
                <Paper className="glass-card" sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#6366F1', letterSpacing: 2 }}>TOTAL QUEUE</Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#6366F1', mt: 1 }}>
                        {prescriptions.length}
                    </Typography>
                </Paper>
            </Box>

            {/* Queue List */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                    <CircularProgress sx={{ color: '#0D9488' }} />
                </Box>
            ) : prescriptions.length === 0 ? (
                <Paper className="glass-card" sx={{ p: 6, textAlign: 'center' }}>
                    <LocalPharmacy sx={{ fontSize: 60, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: '#94A3B8' }}>No pending prescriptions</Typography>
                    <Typography variant="body2" sx={{ color: '#475569', mt: 1 }}>
                        When patients share prescriptions with your pharmacy, they will appear here.
                    </Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {prescriptions.map((rx) => {
                        const isExpanded = expandedId === rx.id;
                        const sc = statusColors[rx.status] || statusColors.pending;
                        return (
                            <Paper key={rx.id} className="glass-card" sx={{ overflow: 'hidden' }}>
                                {/* Prescription Header */}
                                <Box sx={{ p: 3, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : rx.id)}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar sx={{ bgcolor: 'rgba(13, 148, 136, 0.15)', width: 48, height: 48 }}>
                                                <MedicalServices sx={{ color: '#0D9488' }} />
                                            </Avatar>
                                            <Box>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                    {rx.diagnosis || 'Clinical Prescription'}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <AccessTime sx={{ fontSize: 14, color: '#64748B' }} />
                                                        <Typography variant="caption" sx={{ color: '#64748B' }}>
                                                            {formatDate(rx.created_at)}
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        label={`${(rx.medications || []).length} medicines`}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: 'rgba(99, 102, 241, 0.1)',
                                                            color: '#6366F1',
                                                            fontWeight: 700,
                                                            fontSize: 11,
                                                            height: 24,
                                                            border: '1px solid rgba(99, 102, 241, 0.2)'
                                                        }}
                                                    />
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Chip
                                                label={rx.status.toUpperCase()}
                                                size="small"
                                                sx={{
                                                    bgcolor: sc.bg,
                                                    color: sc.color,
                                                    fontWeight: 900,
                                                    fontSize: 10,
                                                    letterSpacing: 1,
                                                    border: `1px solid ${sc.border}`
                                                }}
                                            />
                                            <IconButton size="small">
                                                {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                            </IconButton>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <Box sx={{ px: 3, pb: 3 }}>
                                        <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

                                        {/* Medicine List */}
                                        <Typography variant="caption" sx={{ color: '#64748B', letterSpacing: 2, mb: 1.5, display: 'block' }}>
                                            PRESCRIBED MEDICINES
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                            {(rx.medications || []).map((med, idx) => (
                                                <Paper key={idx} sx={{
                                                    p: 2, bgcolor: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                }}>
                                                    <Box>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{med.name}</Typography>
                                                        <Typography variant="caption" sx={{ color: '#64748B' }}>
                                                            {med.dosage} • {med.frequency} • {med.duration}
                                                        </Typography>
                                                        {med.instructions && (
                                                            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                                                                ℹ️ {med.instructions}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Paper>
                                            ))}
                                        </Box>

                                        {/* Prescription Ref */}
                                        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="caption" sx={{ color: '#1E293B' }}>
                                                REF: {rx.id?.substring(0, 8)?.toUpperCase()}
                                            </Typography>
                                            <IconButton size="small" onClick={() => {
                                                navigator.clipboard.writeText(rx.id);
                                                setSnackbar({ open: true, message: 'Prescription ID copied', severity: 'info' });
                                            }}>
                                                <ContentCopy sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        </Box>

                                        {/* Action Buttons */}
                                        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                startIcon={<Cancel />}
                                                onClick={() => handleDeclineAll(rx.id)}
                                                disabled={processing}
                                                sx={{
                                                    flex: 1, borderRadius: 3, py: 1.5,
                                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                                    '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239, 68, 68, 0.1)' }
                                                }}
                                            >
                                                Decline All
                                            </Button>
                                            <Button
                                                variant="contained"
                                                startIcon={<CheckCircle />}
                                                onClick={() => openDispenseDialog(rx)}
                                                disabled={processing}
                                                sx={{
                                                    flex: 2, borderRadius: 3, py: 1.5,
                                                    bgcolor: '#0D9488',
                                                    '&:hover': { bgcolor: '#0F766E' },
                                                    fontWeight: 700, letterSpacing: 1
                                                }}
                                            >
                                                Dispense Medicines
                                            </Button>
                                        </Box>
                                    </Box>
                                )}
                            </Paper>
                        );
                    })}
                </Box>
            )}

            {/* Dispense Dialog */}
            <Dialog
                open={!!dispensingId}
                onClose={() => !processing && setDispensingId(null)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: '#0A0E1A',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 4
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, letterSpacing: 1 }}>
                    <LocalPharmacy sx={{ mr: 1, verticalAlign: 'middle', color: '#0D9488' }} />
                    DISPENSE MEDICINES
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
                        Toggle each medicine to <strong style={{ color: '#10B981' }}>Accept</strong> (in stock) or <strong style={{ color: '#EF4444' }}>Decline</strong> (not available). 
                        Declined medicines will automatically create a new "Remaining" prescription for the patient.
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dispensingPrescription && (dispensingPrescription.medications || []).map((med, idx) => {
                            const isAccepted = medToggles[med.name] === 'accept';
                            return (
                                <Paper key={idx} sx={{
                                    p: 2.5,
                                    bgcolor: isAccepted ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                                    border: `1px solid ${isAccepted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                    borderRadius: 3,
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{med.name}</Typography>
                                        <Typography variant="caption" sx={{ color: '#64748B' }}>
                                            {med.dosage} • {med.frequency} • {med.duration}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="caption" sx={{
                                            color: isAccepted ? '#10B981' : '#EF4444',
                                            fontWeight: 900, letterSpacing: 1, fontSize: 11
                                        }}>
                                            {isAccepted ? 'ACCEPT' : 'DECLINE'}
                                        </Typography>
                                        <Switch
                                            checked={isAccepted}
                                            onChange={() => handleToggle(med.name)}
                                            sx={{
                                                '& .MuiSwitch-switchBase.Mui-checked': { color: '#10B981' },
                                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10B981' },
                                                '& .MuiSwitch-switchBase': { color: '#EF4444' },
                                                '& .MuiSwitch-track': { backgroundColor: '#EF4444' }
                                            }}
                                        />
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Box>

                    {/* Summary */}
                    {dispensingPrescription && (
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="caption" sx={{ color: '#64748B', letterSpacing: 2 }}>DISPENSE SUMMARY</Typography>
                            <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                                <Typography variant="body2">
                                    <span style={{ color: '#10B981', fontWeight: 700 }}>
                                        {Object.values(medToggles).filter(v => v === 'accept').length}
                                    </span> Accepted
                                </Typography>
                                <Typography variant="body2">
                                    <span style={{ color: '#EF4444', fontWeight: 700 }}>
                                        {Object.values(medToggles).filter(v => v === 'decline').length}
                                    </span> Declined (→ Rollover)
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={() => setDispensingId(null)} disabled={processing} sx={{ borderRadius: 3 }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleDispense}
                        disabled={processing}
                        startIcon={processing ? <CircularProgress size={18} /> : <CheckCircle />}
                        sx={{
                            borderRadius: 3, px: 4, bgcolor: '#0D9488',
                            '&:hover': { bgcolor: '#0F766E' },
                            fontWeight: 700, letterSpacing: 1
                        }}
                    >
                        {processing ? 'Processing...' : 'COMPLETE DISPENSING'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={5000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 3 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
