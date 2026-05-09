import React, { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Button, Fade } from '@mui/material';
import { API_BASE_URL } from '../api';

const glassStyle = {
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
};

export default function AccessHistory() {
    const [tabIndex, setTabIndex] = useState(0);
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        const fetchRecords = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/doctor/access-history`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setRecords(data);
                }
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
        if (tabIndex === 0) return records;
        const types = ['all', 'lab', 'rx', 'discharge', 'imaging'];
        return records.filter(r => r.typeRaw === types[tabIndex]);
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
                <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', mb: 4 }}>
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
                                            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600, fontFamily: 'Outfit' }}>{row.patient_name}</Typography>
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.3)', letterSpacing: 1 }}>{row.hospyn_id}</Typography>
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
