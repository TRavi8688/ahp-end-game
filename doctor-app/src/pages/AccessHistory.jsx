import React, { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Button, Fade, Select, MenuItem, FormControl } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

const glassStyle = {
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
};

// Backend's GET /doctor/access-history (doctor_extensions.py) returns an
// audit-log trail: { history: [{ id, action, patient_id, accessed_at,
// ip_address, metadata }], total }. It does not join patient name, record
// classification, AI summaries, or consent status — those fields never
// existed on this endpoint. Map what's real onto display-friendly labels
// instead of rendering blank/undefined cells for data that was never there.
function actionToTypeLabel(action) {
    if (!action) return { label: 'Record', typeRaw: 'other' };
    if (action.includes('lab')) return { label: 'Laboratory', typeRaw: 'lab' };
    if (action.includes('prescription') || action.includes('rx')) return { label: 'Prescription', typeRaw: 'rx' };
    if (action.includes('discharge')) return { label: 'Discharge', typeRaw: 'discharge' };
    if (action.includes('imaging') || action.includes('radiology')) return { label: 'Imaging', typeRaw: 'imaging' };
    return { label: 'Patient Record', typeRaw: 'other' };
}

function normalizeRecord(raw) {
    const { label, typeRaw } = actionToTypeLabel(raw.action);
    return {
        id: raw.id,
        patient_name: null, // not provided by this endpoint
        hospyn_id: raw.patient_id || null,
        type: label,
        typeRaw,
        ai_summary: (raw.action || '').replace(/_/g, ' '),
        date: raw.accessed_at,
        status: 'active', // this endpoint doesn't track consent/revocation state
    };
}

export default function AccessHistory() {
    const navigate = useNavigate();
    const [tabIndex, setTabIndex] = useState(0);
    const [dateFilter, setDateFilter] = useState('all');
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        const fetchRecords = async () => {
            try {
                // FIXED: was a raw fetch(`${API_BASE_URL}/doctor/access-history`)
                // with no /healthcare prefix (always 404'd), AND treated the
                // whole response body as the records array — the real shape
                // is { history: [...], total }.
                const data = await apiClient.get('/doctor/access-history');
                const history = Array.isArray(data) ? data : data?.history || [];
                setRecords(history.map(normalizeRecord));
            } catch (error) {
                console.error("Failed to fetch access history", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRecords();
    }, []);

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue);
    };

    const getFilteredRecords = () => {
        let filtered = records;
        if (tabIndex !== 0) {
            const types = ['all', 'lab', 'rx', 'discharge', 'imaging'];
            filtered = filtered.filter(r => r.typeRaw === types[tabIndex]);
        }
        
        if (dateFilter !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            filtered = filtered.filter(r => {
                const rowDate = new Date(r.date);
                if (dateFilter === 'today') {
                    return rowDate >= today;
                } else if (dateFilter === '7days') {
                    const sevenDaysAgo = new Date(today);
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    return rowDate >= sevenDaysAgo;
                } else if (dateFilter === '30days') {
                    const thirtyDaysAgo = new Date(today);
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return rowDate >= thirtyDaysAgo;
                }
                return true;
            });
        }
        return filtered;
    };

    const getTypeColor = (type) => {
        if (!type) return { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' };
        switch (type.toLowerCase()) {
            case 'lab': return { bg: 'rgba(20, 184, 166, 0.1)', color: '#14B8A6' };
            case 'rx':
            case 'prescription': return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981' };
            case 'discharge': return { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' };
            case 'imaging':
            case 'radiology': return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' };
            default: return { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' };
        }
    };

    return (
        <Fade in={true} timeout={800}>
            <Box sx={{ maxWidth: 1400, mx: 'auto', py: 2 }}>
                {/* Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" sx={{ 
                        fontFamily: 'Outfit', 
                        fontWeight: 700, 
                        color: '#fff',
                        letterSpacing: '-0.02em'
                    }}>
                        Clinical Access Hub
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
                        Secure audit trail of patient-shared diagnostic files and encrypted summaries.
                    </Typography>
                </Box>

                {/* Filter Tab Strip */}
                <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Tabs 
                        value={tabIndex} 
                        onChange={handleTabChange} 
                        TabIndicatorProps={{ sx: { bgcolor: '#14B8A6', height: 3 } }}
                        sx={{
                            '& .MuiTab-root': {
                                color: 'rgba(255, 255, 255, 0.4)',
                                fontFamily: 'Outfit',
                                fontWeight: 600,
                                textTransform: 'none',
                                fontSize: '1rem',
                                '&.Mui-selected': { color: '#14B8A6' }
                            }
                        }}
                    >
                        <Tab label="All Vaults" />
                        <Tab label="Laboratory" />
                        <Tab label="Prescriptions" />
                        <Tab label="Discharge" />
                        <Tab label="Imaging" />
                    </Tabs>

                    <FormControl size="small" sx={{ minWidth: 150, mb: { xs: 1, sm: 0 } }}>
                        <Select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            sx={{
                                color: 'rgba(255,255,255,0.8)',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#14B8A6' },
                                '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' }
                            }}
                        >
                            <MenuItem value="all">All Time</MenuItem>
                            <MenuItem value="today">Today</MenuItem>
                            <MenuItem value="7days">Last 7 Days</MenuItem>
                            <MenuItem value="30days">Last 30 Days</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                {/* Records Table */}
                <TableContainer component={Paper} elevation={0} sx={{ 
                    ...glassStyle,
                    borderRadius: 4,
                    overflow: 'hidden'
                }}>
                    <Table>
                        <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', py: 2.5 }}>Patient Entity</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>Classification</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>AI Analysis Extract</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>Timestamp</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>Consent Status</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>Intervention</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {getFilteredRecords().map((row) => {
                                const isRevoked = row.status === 'revoked';
                                const tColor = getTypeColor(row.typeRaw);
                                return (
                                    <TableRow 
                                        key={row.id} 
                                        sx={{ 
                                            '&:last-child td, &:last-child th': { border: 0 },
                                            transition: 'background 0.2s',
                                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)' },
                                            opacity: isRevoked ? 0.4 : 1 
                                        }}
                                    >

                                        {/* Patient */}
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600, fontFamily: 'Outfit' }}>
                                                {row.patient_name || row.hospyn_id || 'Unknown patient'}
                                            </Typography>
                                            {row.patient_name && row.hospyn_id && (
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.3)', letterSpacing: 1 }}>{row.hospyn_id}</Typography>
                                            )}
                                        </TableCell>

                                        {/* Record Type */}
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                            <Chip 
                                                label={row.type} 
                                                size="small" 
                                                sx={{ 
                                                    background: tColor.bg, 
                                                    color: tColor.color, 
                                                    fontWeight: 700,
                                                    fontSize: '0.7rem',
                                                    textTransform: 'uppercase',
                                                    borderRadius: 1
                                                }} 
                                            />
                                        </TableCell>

                                        {/* AI Summary */}
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                            <Typography variant="body2" sx={{ 
                                                color: isRevoked ? '#ef4444' : 'rgba(255, 255, 255, 0.7)', 
                                                fontStyle: isRevoked ? 'italic' : 'normal',
                                                maxWidth: 400,
                                                lineHeight: 1.6
                                            }}>
                                                {row.ai_summary}
                                            </Typography>
                                        </TableCell>

                                        {/* Date */}
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.4)' }}>{row.date}</Typography>
                                        </TableCell>

                                        {/* Status */}
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ 
                                                    width: 6, height: 6, borderRadius: '50%', 
                                                    bgcolor: isRevoked ? '#ef4444' : '#14B8A6',
                                                    boxShadow: `0 0 10px ${isRevoked ? '#ef4444' : '#14B8A6'}`
                                                }} />
                                                <Typography variant="caption" sx={{ color: isRevoked ? '#ef4444' : '#14B8A6', fontWeight: 700, textTransform: 'uppercase' }}>
                                                    {isRevoked ? "Expired" : "Active Flow"}
                                                </Typography>
                                            </Box>
                                        </TableCell>

                                        {/* Action */}
                                        <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                            <Button
                                                variant="text"
                                                size="small"
                                                disabled={isRevoked}
                                                onClick={() => row.hospyn_id && navigate(`/patient/${row.hospyn_id}`)}
                                                sx={{ 
                                                    color: '#14B8A6', 
                                                    textTransform: 'none', 
                                                    fontWeight: 600, 
                                                    fontFamily: 'Outfit',
                                                    '&:hover': { background: 'rgba(20, 184, 166, 0.1)' }
                                                }}
                                            >
                                                Examine
                                            </Button>
                                        </TableCell>

                                    </TableRow>
                                );
                            })}
                            {getFilteredRecords().length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic' }}>
                                            No clinical records detected in this vault partition.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

            </Box>
        </Fade>
    );
}
