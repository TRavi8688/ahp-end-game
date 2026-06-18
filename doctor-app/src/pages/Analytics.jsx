import React from 'react';
import { Box, Typography, Grid, Card, CardContent } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { doctorService } from '../services/doctorService';

// FULL FIX (item #3 — "analytics dashboard still using mock data"):
//   - This page was ALREADY calling GET /doctor/analytics for most of its
//     numbers — that endpoint never existed on the backend (see backend
//     patch: routes/doctor_schedule_routes.py), so the fetch always
//     silently failed and every stat fell back to its `|| 0` default,
//     which looks identical to "mock data" / a dashboard that never
//     changes. Now wired to the real, newly-built endpoint.
//   - It was also using a raw fetch() against the old broken
//     API_BASE_URL (see .env fix).
//   - The "Average: 13.4 / day · Peak: Tuesday (18)" line at the bottom
//     WAS genuinely hardcoded — never computed from data at all. Fixed
//     to calculate both from the real weekly_stats response.
//   - Restyled from a light theme (the only page in the app using one)
//     to match the dark theme used everywhere else.

export default function Analytics() {
    const [data, setData] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState(false);

    React.useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const response = await doctorService.getAnalytics();
                setData(response);
            } catch (error) {
                console.error("Failed to fetch analytics", error);
                setLoadError(true);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    const conditionChart = data?.conditions || [];
    const weeklyConsults = data?.weekly_stats || [];

    // Computed (not hardcoded) average/peak for the weekly chart footer.
    const totalWeekCount = weeklyConsults.reduce((sum, w) => sum + (w.count || 0), 0);
    const avgPerDay = weeklyConsults.length ? (totalWeekCount / weeklyConsults.length).toFixed(1) : '0.0';
    const peakDay = weeklyConsults.reduce(
        (peak, w) => (w.count > (peak?.count || -1) ? w : peak),
        null
    );

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Typography variant="h6" sx={{ color: '#cbd5e1' }}>Loading Analytics Engine...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', pb: 8 }}>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#fff' }}>
                    Panel Analytics
                </Typography>
                <Typography variant="body1" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                    Aggregate insights and safety metrics across your entire patient panel.
                </Typography>
                {loadError && (
                    <Typography variant="body2" sx={{ color: '#f59e0b', mt: 1 }}>
                        Couldn't load live analytics — showing zeros until the connection is restored.
                    </Typography>
                )}
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
                    <Card elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, height: 350, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff' }}>Common Conditions in Panel</Typography>
                        </Box>
                        {conditionChart.length === 0 ? (
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography variant="body2" sx={{ color: '#cbd5e1' }}>Not enough recorded visits yet to chart conditions.</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ p: 3, flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 2 }}>
                                {conditionChart.map((c, i) => (
                                    <Box key={c.label || i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20%', height: '100%', justifyContent: 'flex-end' }}>
                                        <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, color: '#cbd5e1' }}>{c.percent}%</Typography>
                                        <Box sx={{ width: '100%', height: `${Math.max(c.percent, 5)}%`, bgcolor: c.color, borderRadius: '4px 4px 0 0', transition: 'height 1s ease-in-out' }} />
                                        <Box sx={{ mt: 1, textAlign: 'center', height: '30px' }}>
                                            <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block', lineHeight: 1 }}>{c.label}</Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Card>
                </Grid>

                {/* Right Chart */}
                <Grid item xs={12} md={6}>
                    <Card elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, height: 350, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff' }}>Consultations per Day (This Week)</Typography>
                        </Box>
                        <Box sx={{ p: 3, flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 2 }}>
                            {weeklyConsults.map((w, i) => {
                                const heightPercent = (w.count / (w.max || 1)) * 100;
                                return (
                                    <Box key={w.day || i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '15%', height: '100%', justifyContent: 'flex-end' }}>
                                        <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, color: '#0d9488' }}>{w.count}</Typography>
                                        <Box sx={{ width: '100%', height: `${Math.max(heightPercent, 5)}%`, bgcolor: '#0d9488', borderRadius: '4px 4px 0 0', opacity: 0.8, transition: 'height 1s ease-in-out' }} />
                                        <Typography variant="caption" sx={{ color: '#cbd5e1', mt: 1, fontWeight: 'bold' }}>{w.day}</Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                        <Box sx={{ p: 2, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                            <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                                Average: <strong style={{ color: '#fff' }}>{avgPerDay}</strong> / day
                                {peakDay && (
                                    <> · Peak: <strong style={{ color: '#fff' }}>{peakDay.day} ({peakDay.count})</strong></>
                                )}
                            </Typography>
                        </Box>
                    </Card>
                </Grid>
            </Grid>

            {/* AI Safety Catches Log */}
            <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff', mb: 3 }}>
                Drug Interaction Alerts Caught (This Month)
            </Typography>
            <Card elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2 }}>
                {(!data?.alerts || data.alerts.length === 0) ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography sx={{ color: '#cbd5e1' }}>No clinical safety alerts triggered this month.</Typography>
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
    <Card elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)', borderTop: `4px solid ${border}`, borderRadius: 2 }}>
        <CardContent>
            <Typography variant="h3" fontWeight="bold" sx={{ color: '#fff', mb: 1 }}>{value}</Typography>
            <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 'bold' }}>{title}</Typography>
        </CardContent>
    </Card>
);

const SafetyLogEntry = ({ drugA, allergen, patient, date, status, color, borderLeft, note }) => (
    <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.08)', borderLeft: `6px solid ${borderLeft}`, '&:last-child': { borderBottom: 'none' } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
                <Grid container alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Grid item>
                        <WarningAmberIcon sx={{ color: borderLeft }} />
                    </Grid>
                    <Grid item>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#fff' }}>
                            {drugA} {allergen && `+ ${allergen}`}
                        </Typography>
                    </Grid>
                </Grid>
                <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 0.5 }}>
                    <strong>{patient}</strong> · Caught {date}
                </Typography>
                {note && (
                    <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic', mt: 1 }}>
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
