import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, Button, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';

import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ScienceIcon from '@mui/icons-material/Science';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';

export default function Alerts() {
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        const fetchAlerts = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/doctor/alerts`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setAlerts(data);
                }
            } catch (error) {
                console.error("Error fetching alerts:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAlerts();

        // WebSocket for Real-time Alerts
        const token = localStorage.getItem('token');
        if (!token) return;

        // Extract host and port from API_BASE_URL for WebSocket
        const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/ws/${token}`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'patient_update') {
                    // Prepend a fresh alert or just re-fetch all
                    fetchAlerts();
                }
            } catch (err) {
                console.error("WS Alert Error:", err);
            }
        };

        return () => ws.close();
    }, []);

    const handleMarkRead = (id) => {
        setAlerts(alerts.map(a => a.id === id ? { ...a, unread: false } : a));
        // Optional: Call API to mark as read in DB
    };

    const getIconConfig = (type) => {
        switch (type) {
            case 'drug': return { icon: <WarningAmberIcon sx={{ color: '#ef4444' }} />, bg: '#fee2e2' }; // Red
            case 'revoked': return { icon: <LockIcon sx={{ color: '#ef4444' }} />, bg: '#fee2e2' }; // Red
            case 'followup': return { icon: <AccessTimeIcon sx={{ color: '#f59e0b' }} />, bg: '#fef3c7' }; // Amber
            case 'lab': return { icon: <ScienceIcon sx={{ color: '#0d9488' }} />, bg: '#ccfbf1' }; // Teal
            case 'granted': return { icon: <PersonAddAlt1Icon sx={{ color: '#0d9488' }} />, bg: '#ccfbf1' }; // Teal
            case 'update': return { icon: <CheckCircleOutlinedIcon sx={{ color: '#10b981' }} />, bg: '#d1fae5' }; // Green
            default: return { icon: <CheckCircleOutlinedIcon sx={{ color: '#6b7280' }} />, bg: '#f3f4f6' };
        }
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', pb: 8 }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{ color: '#1f2937' }}>
                        Alerts & Notifications
                    </Typography>
                </Box>
                <Button variant="outlined" sx={{ color: '#4b5563', borderColor: '#d1d5db' }} onClick={() => setAlerts(alerts.map(a => ({ ...a, unread: false })))}>
                    Mark all as read
                </Button>
            </Box>

            <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                {alerts.length === 0 ? (
                    <Box sx={{ p: 6, textAlign: 'center' }}>
                        <CheckCircleOutlinedIcon sx={{ fontSize: 64, color: '#e5e7eb', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#4b5563', fontWeight: 'bold' }}>All clear!</Typography>
                        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 1 }}>You have no new notifications or alerts at this time.</Typography>
                    </Box>
                ) : alerts.map((alert, index) => {
                    const iconConf = getIconConfig(alert.type);
                    return (
                        <Box
                            key={alert.id}
                            onClick={() => { if (alert.unread) handleMarkRead(alert.id); }}
                            sx={{
                                p: 3,
                                borderBottom: index < alerts.length - 1 ? '1px solid #e5e7eb' : 'none',
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
                            {alert.type === 'drug' && (
                                <Button variant="outlined" color="error" size="small">Review</Button>
                            )}
                            {(alert.type === 'followup' || alert.type === 'granted') && (
                                <Button variant="outlined" size="small" onClick={() => alert.patientId && navigate(`/patient/${alert.patientId}`)} sx={{ color: '#0d9488', borderColor: '#0d9488' }}>
                                    View Patient
                                </Button>
                            )}
                            {(alert.type === 'lab') && (
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
