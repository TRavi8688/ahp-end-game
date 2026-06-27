import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, Button, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useSocket } from '../contexts/SocketContext';

import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ScienceIcon from '@mui/icons-material/Science';

// Backend's GET /doctor/alerts (doctor_extensions.py) only ever returns two
// alert "type" values — "lab_result" and "critical_flag" — and each item is
// { type, severity, title, patient_name, created_at, ref_id }. There is no
// patient_id on these rows (so per-alert patient navigation isn't possible
// from this endpoint), and no per-alert read/unread flag — every alert
// returned here is, by the endpoint's own query, something not yet
// reviewed/acknowledged, so we treat everything returned as unread until
// marked read locally.
function normalizeAlert(raw, idx) {
    return {
        id: raw.ref_id || `alert-${idx}`,
        type: raw.type,
        title: raw.title,
        desc: raw.patient_name ? `Patient: ${raw.patient_name}` : '',
        time: raw.created_at,
        unread: true,
    };
}

export default function Alerts() {
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState([]);
    const [readIds, setReadIds] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const { lastMessage, isConnected } = useSocket();

    const fetchAlerts = async () => {
        setIsLoading(true);
        try {
            // FIXED: was a raw fetch(`${API_BASE_URL}/doctor/alerts`) with
            // no /healthcare prefix (always 404'd), and even on success
            // treated the response body itself as the alerts array — the
            // real shape is { alerts: [...], total, unread_count }.
            const data = await apiClient.get('/doctor/alerts');
            const list = Array.isArray(data) ? data : data?.alerts || [];
            setAlerts(list.map(normalizeAlert));
        } catch (error) {
            console.error("Error fetching alerts:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    // FIXED: this page used to open its own second, independently-broken
    // WebSocket (ws://host/ws/${token} — that path doesn't exist anywhere
    // on the backend; the real endpoint is /ws/reception?token=...).
    // QueueScreen.jsx already shows the correct pattern: reuse the single
    // shared connection from SocketContext (lastMessage/isConnected)
    // rather than opening a duplicate, separately-broken one.
    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'patient_update' || lastMessage.type === 'queue_update') {
            fetchAlerts();
        }
    }, [lastMessage]);

    const handleMarkRead = (id) => {
        setReadIds(prev => new Set(prev).add(id));
    };

    const getIconConfig = (type) => {
        switch (type) {
            case 'critical_flag': return { icon: <WarningAmberIcon sx={{ color: '#ef4444' }} />, bg: '#fee2e2' }; // Red
            case 'lab_result': return { icon: <ScienceIcon sx={{ color: '#0d9488' }} />, bg: '#ccfbf1' }; // Teal
            default: return { icon: <CheckCircleOutlinedIcon sx={{ color: '#6b7280' }} />, bg: '#f3f4f6' };
        }
    };

    const displayAlerts = alerts.map(a => ({ ...a, unread: a.unread && !readIds.has(a.id) }));

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', pb: 8 }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{ color: '#1f2937' }}>
                        Alerts & Notifications
                    </Typography>
                    {!isConnected && (
                        <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                            Live updates reconnecting — showing last refreshed data.
                        </Typography>
                    )}
                </Box>
                <Button
                    variant="outlined"
                    sx={{ color: '#4b5563', borderColor: '#d1d5db' }}
                    onClick={() => setReadIds(new Set(displayAlerts.map(a => a.id)))}
                >
                    Mark all as read
                </Button>
            </Box>

            <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                {displayAlerts.length === 0 ? (
                    <Box sx={{ p: 6, textAlign: 'center' }}>
                        <CheckCircleOutlinedIcon sx={{ fontSize: 64, color: '#e5e7eb', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#4b5563', fontWeight: 'bold' }}>All clear!</Typography>
                        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 1 }}>You have no new notifications or alerts at this time.</Typography>
                    </Box>
                ) : displayAlerts.map((alert, index) => {
                    const iconConf = getIconConfig(alert.type);
                    return (
                        <Box
                            key={alert.id}
                            onClick={() => { if (alert.unread) handleMarkRead(alert.id); }}
                            sx={{
                                p: 3,
                                borderBottom: index < displayAlerts.length - 1 ? '1px solid #e5e7eb' : 'none',
                                bgcolor: alert.unread ? '#f8fafc' : 'white', // slightly blue if unread
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 2,
                                cursor: alert.unread ? 'pointer' : 'default',
                                '&:hover': { bgcolor: alert.unread ? '#f1f5f9' : '#f9fafb' }
                            }}
                        >
                            {/* Unread Dot */}
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: alert.unread ? '#3b82f6' : 'transparent', mt: 1.5, flexShrink: 0 }} />

                            {/* Icon */}
                            <Avatar sx={{ bgcolor: iconConf.bg, width: 48, height: 48 }}>
                                {iconConf.icon}
                            </Avatar>

                            {/* Content */}
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: alert.unread ? '#111827' : '#4b5563', mb: 0.5 }}>
                                    {alert.title}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#4b5563', mb: 1 }}>
                                    {alert.desc}
                                </Typography>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#9ca3af', fontWeight: 'bold' }}>
                                    {alert.time}
                                </Typography>
                            </Box>

                            {/* Action Button */}
                            {alert.type === 'critical_flag' && (
                                <Button variant="outlined" color="error" size="small">Review</Button>
                            )}
                            {alert.type === 'lab_result' && (
                                <Button variant="outlined" size="small" onClick={() => navigate('/history')} sx={{ color: '#0d9488', borderColor: '#0d9488' }}>
                                    View
                                </Button>
                            )}
                        </Box>
                    );
                })}
            </Card>
        </Box>
    );
}
