import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, Grid, Button, Chip, CircularProgress,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Select, MenuItem, FormControl, InputLabel, Divider
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import DownloadIcon from '@mui/icons-material/Download';
import { clinicalService } from '../services/clinicalService';

const PERIODS = [
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'Last 3 Months', value: 'quarter' },
    { label: 'This Year', value: 'year' },
];

// Fallback mock data so UI works even if backend is not ready
const MOCK_DATA = {
    total_earnings: 48500,
    pending_payout: 12300,
    consultations_count: 97,
    avg_per_consultation: 500,
    growth_percent: 14.2,
    transactions: [
        { id: 'TXN001', patient_name: 'Arjun Sharma', date: '2026-06-01', type: 'Consultation', amount: 500, status: 'paid' },
        { id: 'TXN002', patient_name: 'Priya Mehta', date: '2026-06-01', type: 'Follow-up', amount: 300, status: 'paid' },
        { id: 'TXN003', patient_name: 'Rahul Verma', date: '2026-05-31', type: 'Consultation', amount: 500, status: 'pending' },
        { id: 'TXN004', patient_name: 'Sunita Rao', date: '2026-05-30', type: 'Teleconsult', amount: 400, status: 'paid' },
        { id: 'TXN005', patient_name: 'Amit Patel', date: '2026-05-29', type: 'Consultation', amount: 500, status: 'paid' },
        { id: 'TXN006', patient_name: 'Kavya Singh', date: '2026-05-28', type: 'Follow-up', amount: 300, status: 'pending' },
    ]
};

export default function EarningsDashboard() {
    const [period, setPeriod] = useState('month');
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchEarnings = async () => {
            setIsLoading(true);
            try {
                const result = await clinicalService.getEarnings(period);
                setData(result);
            } catch (error) {
                console.error('Earnings fetch error:', error);
                // Use mock data so screen is functional during backend development
                setData(MOCK_DATA);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEarnings();
    }, [period]);

    const formatCurrency = (val) => `₹${(val || 0).toLocaleString('en-IN')}`;

    const stats = [
        {
            title: 'Total Earnings',
            value: formatCurrency(data?.total_earnings),
            change: `+${data?.growth_percent || 0}% vs last period`,
            color: '#10b981',
            icon: <AccountBalanceWalletIcon sx={{ fontSize: 36 }} />,
        },
        {
            title: 'Pending Payout',
            value: formatCurrency(data?.pending_payout),
            change: 'Awaiting settlement',
            color: '#f59e0b',
            icon: <TrendingUpIcon sx={{ fontSize: 36 }} />,
        },
        {
            title: 'Consultations',
            value: data?.consultations_count || 0,
            change: 'Sessions this period',
            color: '#6366f1',
            icon: <PeopleIcon sx={{ fontSize: 36 }} />,
        },
        {
            title: 'Avg Per Visit',
            value: formatCurrency(data?.avg_per_consultation),
            change: 'Per consultation',
            color: '#0ea5e9',
            icon: <ReceiptLongIcon sx={{ fontSize: 36 }} />,
        },
    ];

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 4 }, pt: 4, pb: 8 }}>
            {/* Header */}
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Syne', letterSpacing: '-0.04em', mb: 1 }}>
                        Earnings
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                        Your financial performance at a glance
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select value={period} onChange={(e) => setPeriod(e.target.value)}
                            sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '12px', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }, '& .MuiSvgIcon-root': { color: '#cbd5e1' } }}>
                            {PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button variant="outlined" startIcon={<DownloadIcon />}
                        sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '12px', fontWeight: 700, '&:hover': { borderColor: 'rgba(255,255,255,0.3)', color: '#fff' } }}>
                        Export
                    </Button>
                </Box>
            </Box>

            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}>
                    <CircularProgress sx={{ color: '#0d9488' }} />
                </Box>
            ) : (
                <>
                    {/* Stats Grid */}
                    <Grid container spacing={3} sx={{ mb: 6 }}>
                        {stats.map((s) => (
                            <Grid item xs={12} sm={6} md={3} key={s.title}>
                                <Card elevation={0} sx={{
                                    p: 4, height: '100%', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px',
                                    position: 'relative', overflow: 'hidden',
                                    transition: 'all 0.3s', '&:hover': { transform: 'translateY(-6px)', bgcolor: 'rgba(255,255,255,0.04)', boxShadow: `0 20px 40px rgba(0,0,0,0.4), 0 0 20px ${s.color}15` }
                                }}>
                                    <Box sx={{ position: 'absolute', top: 16, right: 16, opacity: 0.12, color: s.color }}>{s.icon}</Box>
                                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', mb: 1, fontFamily: 'Outfit' }}>{s.value}</Typography>
                                    <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1 }}>{s.title}</Typography>
                                    <Typography variant="caption" sx={{ color: s.color, fontWeight: 800 }}>{s.change}</Typography>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Earnings Bar Chart (Simple visual) */}
                    <Card elevation={0} sx={{ p: 4, mb: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Syne', mb: 4 }}>Earnings Trend</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                            {(data?.weekly_breakdown || [14000, 18000, 9500, 22000, 16000, 19500, 24000]).map((val, i) => {
                                const max = Math.max(...(data?.weekly_breakdown || [14000, 18000, 9500, 22000, 16000, 19500, 24000]));
                                const height = (val / max) * 100;
                                const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                                return (
                                    <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{
                                            width: '100%', height: `${height}%`, minHeight: 8,
                                            bgcolor: i === 6 ? '#0d9488' : 'rgba(99,102,241,0.4)',
                                            borderRadius: '8px 8px 0 0',
                                            transition: 'all 0.3s',
                                            '&:hover': { bgcolor: '#0d9488', transform: 'scaleY(1.05)', transformOrigin: 'bottom' }
                                        }} />
                                        <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.65rem' }}>{days[i]}</Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Card>

                    {/* Transactions Table */}
                    <Card elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', overflow: 'hidden' }}>
                        <Box sx={{ p: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'Syne' }}>Transaction History</Typography>
                        </Box>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ '& .MuiTableCell-root': { borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontWeight: 900, fontSize: '0.75rem', letterSpacing: 1, textTransform: 'uppercase', py: 2 } }}>
                                        <TableCell>Transaction ID</TableCell>
                                        <TableCell>Patient</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell align="right">Amount</TableCell>
                                        <TableCell align="right">Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(data?.transactions || []).map((txn) => (
                                        <TableRow key={txn.id} sx={{ '& .MuiTableCell-root': { borderColor: 'rgba(255,255,255,0.04)', color: '#fff', py: 2.5 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                                            <TableCell>
                                                <Typography variant="caption" sx={{ fontFamily: 'Space Mono', color: '#cbd5e1', fontWeight: 700 }}>{txn.id}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff' }}>{txn.patient_name}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ color: '#cbd5e1' }}>{new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={txn.type} size="small" sx={{ bgcolor: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontWeight: 700, border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.7rem' }} />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" sx={{ fontWeight: 900, color: '#10b981', fontFamily: 'Space Mono' }}>{formatCurrency(txn.amount)}</Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Chip label={txn.status?.toUpperCase()} size="small"
                                                    sx={{
                                                        bgcolor: txn.status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                                        color: txn.status === 'paid' ? '#10b981' : '#f59e0b',
                                                        border: `1px solid ${txn.status === 'paid' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                                                        fontWeight: 900, fontSize: '0.65rem'
                                                    }} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        {(!data?.transactions || data.transactions.length === 0) && (
                            <Box sx={{ p: 6, textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#cbd5e1' }}>No transactions found for this period.</Typography>
                            </Box>
                        )}
                    </Card>
                </>
            )}
        </Box>
    );
}
