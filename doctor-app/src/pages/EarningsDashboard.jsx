import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, Grid, Button, CircularProgress,
    Select, MenuItem, FormControl, Alert
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import { clinicalService } from '../services/clinicalService';

const PERIODS = [
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'This Year', value: 'year' },
];

// FIXED: this page used to silently fall back to a large block of
// fabricated mock data (pending_payout, transactions, weekly_breakdown,
// growth_percent) whenever the real API call failed for any reason —
// hiding genuine errors behind numbers that looked plausible but were
// invented.
//
// Separately, even when the real call *succeeds*, the backend's
// GET /doctor/earnings (doctor_schedule_routes.py) only ever returns
// { period, completed_consultations, consultation_fee, total_earnings,
// currency } — there is no payments/transaction ledger backing this
// feature at all, just a "completed visits × consultation fee" estimate.
// Showing a fake pending-payout figure or per-transaction history table
// would be actively misleading to a doctor checking their income, so this
// page now only displays the three numbers the backend can actually
// vouch for, and shows a real error (not fake data) if the call fails.
export default function EarningsDashboard() {
    const [period, setPeriod] = useState('month');
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchEarnings = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const result = await clinicalService.getEarnings(period);
                setData(result);
            } catch (err) {
                console.error('Earnings fetch error:', err);
                setError(err.message || 'Could not load earnings right now.');
                setData(null);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEarnings();
    }, [period]);

    const formatCurrency = (val) => `₹${(val || 0).toLocaleString('en-IN')}`;

    const stats = data ? [
        {
            title: 'Estimated Earnings',
            value: formatCurrency(data.total_earnings),
            change: `${data.currency || 'INR'} · ${PERIODS.find(p => p.value === period)?.label || period}`,
            color: '#10b981',
            icon: <AccountBalanceWalletIcon sx={{ fontSize: 36 }} />,
        },
        {
            title: 'Completed Consultations',
            value: data.completed_consultations ?? 0,
            change: 'Sessions this period',
            color: '#6366f1',
            icon: <PeopleIcon sx={{ fontSize: 36 }} />,
        },
        {
            title: 'Consultation Fee',
            value: formatCurrency(data.consultation_fee),
            change: 'Per session, as configured',
            color: '#0ea5e9',
            icon: <ReceiptLongIcon sx={{ fontSize: 36 }} />,
        },
    ] : [];

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 4 }, pt: 4, pb: 8 }}>
            {/* Header */}
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Syne', letterSpacing: '-0.04em', mb: 1 }}>
                        Earnings
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Estimated earnings based on completed consultations
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select value={period} onChange={(e) => setPeriod(e.target.value)}
                            sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '12px', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }, '& .MuiSvgIcon-root': { color: '#64748b' } }}>
                            {PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}>
                    <CircularProgress sx={{ color: '#0d9488' }} />
                </Box>
            ) : error ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
            ) : (
                <>
                    {/* Stats Grid */}
                    <Grid container spacing={3} sx={{ mb: 6 }}>
                        {stats.map((s) => (
                            <Grid item xs={12} sm={6} md={4} key={s.title}>
                                <Card elevation={0} sx={{
                                    p: 4, height: '100%', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px',
                                    position: 'relative', overflow: 'hidden',
                                    transition: 'all 0.3s', '&:hover': { transform: 'translateY(-6px)', bgcolor: 'rgba(255,255,255,0.04)', boxShadow: `0 20px 40px rgba(0,0,0,0.4), 0 0 20px ${s.color}15` }
                                }}>
                                    <Box sx={{ position: 'absolute', top: 16, right: 16, opacity: 0.12, color: s.color }}>{s.icon}</Box>
                                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', mb: 1, fontFamily: 'Outfit' }}>{s.value}</Typography>
                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>{s.title}</Typography>
                                    <Typography variant="caption" sx={{ color: s.color, fontWeight: 800 }}>{s.change}</Typography>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    <Alert severity="info" sx={{ borderRadius: 2, bgcolor: 'rgba(99,102,241,0.08)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
                        This is an estimate based on completed consultations × your configured consultation fee.
                        Per-transaction payout history isn't available yet.
                    </Alert>
                </>
            )}
        </Box>
    );
}
