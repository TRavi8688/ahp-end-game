import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { API_BASE_URL } from '../api';

export default function Analytics() {
    const [data, setData] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/doctor/analytics`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (response.ok) {
                    setData(await response.json());
                }
            } catch (error) {
                console.error("Failed to fetch analytics", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    const conditionChart = data?.conditions || [];
    const weeklyConsults = data?.weekly_stats || [];

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', pb: 8 }}>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#1f2937' }}>
                    Panel Analytics
                </Typography>
                <Typography variant="body1" sx={{ color: '#6b7280', mt: 0.5 }}>
                    Aggregate insights and safety metrics across your entire patient panel.
                </Typography>
            </Box>

            {/* Stats Row */}
            <Grid container spacing={3} sx={{ mb: 5 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatBox title="Total Active Patients" value={data?.total_patients || 0} border="#3b82f6" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatBox title="Stable / Well-controlled" value={data?.stable_count || 0} border="#10b981" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatBox title="Require Follow-up" value={data?.followup_count || 0} border="#f59e0b" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatBox title="High-Risk" value={data?.high_risk_count || 0} border="#ef4444" />
                </Grid>
            </Grid>

            {/* Charts Row */}
            <Grid container spacing={4} sx={{ mb: 5 }}>
                {/* Left Chart */}
                <Grid item xs={12} md={6}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, height: 350, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937' }}>Common Conditions in Panel</Typography>
                        </Box>
                        <Box sx={{ p: 3, flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 2 }}>
                            {conditionChart.map(c => (
                                <Box key={c.label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20%' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, color: '#4b5563' }}>{c.percent}%</Typography>
                                    <Box sx={{ width: '100%', height: `${c.percent * 2}px`, bgcolor: c.color, borderRadius: '4px 4px 0 0', transition: 'height 1s' }} />
                                    <Box sx={{ mt: 1, textAlign: 'center' }}>
                                        <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', lineHeight: 1 }}>{c.label}</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Card>
                </Grid>

                {/* Right Chart */}
                <Grid item xs={12} md={6}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, height: 350, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937' }}>Consultations per Day (This Week)</Typography>
                        </Box>
                        <Box sx={{ p: 3, flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 2 }}>
                            {weeklyConsults.map(w => {
                                const heightPercent = (w.count / w.max) * 100;
                                return (
                                    <Box key={w.day} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '15%' }}>
                                        <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, color: '#0d9488' }}>{w.count}</Typography>
                                        <Box sx={{ width: '100%', height: `${heightPercent * 1.5}px`, bgcolor: '#0d9488', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                                        <Typography variant="caption" sx={{ color: '#6b7280', mt: 1, fontWeight: 'bold' }}>{w.day}</Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                        <Box sx={{ p: 2, textAlign: 'center', borderTop: '1px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                            <Typography variant="body2" sx={{ color: '#4b5563' }}>Average: <strong>13.4</strong> / day · Peak: <strong>Tuesday (18)</strong></Typography>
                        </Box>
                    </Card>
                </Grid>
            </Grid>

            {/* AI Safety Catches Log */}
            <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937', mb: 3 }}>
                Drug Interaction Alerts Caught (This Month)
            </Typography>
            <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                {(!data?.alerts || data.alerts.length === 0) ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">No clinical safety alerts triggered this month.</Typography>
                    </Box>
                ) : (
                    data.alerts.map((alert, idx) => (
                        <SafetyLogEntry
                            key={idx}
                            drugA={alert.title}
                            allergen=""
                            patient={alert.patient_name}
                            date={alert.date}
                            status={alert.status}
                            color="#10b981"
                            borderLeft="#ef4444"
                        />
                    ))
                )}
            </Card>

        </Box>
    );
}

const StatBox = ({ title, value, border }) => (
    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderTop: `4px solid ${border}`, borderRadius: 2 }}>
        <CardContent>
            <Typography variant="h3" fontWeight="bold" sx={{ color: '#111827', mb: 1 }}>{value}</Typography>
            <Typography variant="body2" sx={{ color: '#6b7280', fontWeight: 'bold' }}>{title}</Typography>
        </CardContent>
    </Card>
);

const SafetyLogEntry = ({ drugA, allergen, patient, date, status, color, borderLeft, note }) => (
    <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb', borderLeft: `6px solid ${borderLeft}`, '&:last-child': { borderBottom: 'none' }, bgcolor: 'white' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
                <Grid container alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Grid item>
                        <WarningAmberIcon sx={{ color: borderLeft }} />
                    </Grid>
                    <Grid item>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#111827' }}>
                            {drugA} + {allergen}
                        </Typography>
                    </Grid>
                </Grid>
                <Typography variant="body2" sx={{ color: '#4b5563', mb: 0.5 }}>
                    <strong>{patient}</strong> · Caught {date}
                </Typography>
                {note && (
                    <Typography variant="body2" sx={{ color: '#9ca3af', fontStyle: 'italic', mt: 1 }}>
                        " {note} "
                    </Typography>
                )}
            </Box>
            <Box sx={{ textAlign: 'right' }}>
                <Typography
                    variant="caption"
                    sx={{
                        color: color,
                        bgcolor: `${color}15`,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5
                    }}
                >
                    {status === 'Prevented' && <CheckCircleOutlinedIcon fontSize="small" />}
                    {status}
                </Typography>
            </Box>
        </Box>
    </Box>
);
