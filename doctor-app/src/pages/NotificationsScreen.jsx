import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Card, Button, Chip, CircularProgress,
    IconButton, Divider, Snackbar, Alert, Tooltip
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { clinicalService } from '../services/clinicalService';

import NotificationsIcon from '@mui/icons-material/Notifications';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import MedicationIcon from '@mui/icons-material/Medication';
import PersonIcon from '@mui/icons-material/Person';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RefreshIcon from '@mui/icons-material/Refresh';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const TYPE_CONFIG = {
    prescription: { icon: <MedicationIcon />, color: '#0d9488', bg: 'rgba(13,148,136,0.1)' },
    patient: { icon: <PersonIcon />, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    alert: { icon: <WarningAmberIcon />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    emergency: { icon: <LocalHospitalIcon />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    appointment: { icon: <CalendarTodayIcon />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    system: { icon: <NotificationsIcon />, color: '#64748b', bg: 'rgba(255,255,255,0.05)' },
};

// Mock data for when backend not ready
const MOCK_NOTIFICATIONS = [
    { id: 'N001', type: 'patient', title: 'New Patient Arrived', body: 'Arjun Sharma (Token #5) has checked in and is waiting.', created_at: new Date(Date.now() - 5 * 60000).toISOString(), is_read: false, patient_id: null },
    { id: 'N002', type: 'prescription', title: 'Prescription Dispensed', body: 'Amoxicillin prescribed to Priya Mehta has been dispensed by the pharmacy.', created_at: new Date(Date.now() - 20 * 60000).toISOString(), is_read: false, patient_id: null },
    { id: 'N003', type: 'alert', title: 'Drug Interaction Warning', body: 'Potential interaction detected for Rahul Verma: Warfarin + Aspirin.', created_at: new Date(Date.now() - 45 * 60000).toISOString(), is_read: false, patient_id: null },
    { id: 'N004', type: 'appointment', title: 'Appointment Reminder', body: 'You have 3 consultations scheduled for tomorrow morning.', created_at: new Date(Date.now() - 2 * 3600000).toISOString(), is_read: true, patient_id: null },
    { id: 'N005', type: 'system', title: 'System Update', body: 'Hospain network has been updated. New AI diagnostic features are now available.', created_at: new Date(Date.now() - 5 * 3600000).toISOString(), is_read: true, patient_id: null },
    { id: 'N006', type: 'patient', title: 'Access Request', body: 'Sunita Rao has approved your medical record access request.', created_at: new Date(Date.now() - 24 * 3600000).toISOString(), is_read: true, patient_id: null },
];

function timeAgo(dateStr) {
    const now = new Date();
    const then = new Date(dateStr);
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsScreen() {
    const navigate = useNavigate();
    const { lastMessage } = useSocket();
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all | unread
    const [markingAll, setMarkingAll] = useState(false);
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

    const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });

    const fetchNotifications = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await clinicalService.getNotifications();
            const list = Array.isArray(data) ? data : data?.notifications || MOCK_NOTIFICATIONS;
            setNotifications(list);
        } catch (error) {
            console.error('Notifications fetch error:', error);
            setNotifications(MOCK_NOTIFICATIONS);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    // Real-time: new notification via WebSocket
    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'notification' || lastMessage.type === 'new_notification') {
            // Prepend new notification
            setNotifications(prev => [{ ...lastMessage.data, is_read: false }, ...prev]);
        }
    }, [lastMessage]);

    const handleMarkRead = async (notificationId) => {
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
        try {
            await clinicalService.markNotificationRead(notificationId);
        } catch (error) {
            console.error('Mark read error:', error);
        }
    };

    const handleMarkAllRead = async () => {
        setMarkingAll(true);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        try {
            await clinicalService.markAllNotificationsRead();
            showToast('All notifications marked as read.');
        } catch (error) {
            console.error('Mark all read error:', error);
            showToast('Marked as read.', 'info');
        } finally {
            setMarkingAll(false);
        }
    };

    const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, md: 4 }, pt: 4, pb: 8 }}>
            {/* Header */}
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Syne', letterSpacing: '-0.04em' }}>
                            Notifications
                        </Typography>
                        {unreadCount > 0 && (
                            <Chip label={unreadCount} size="small" sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 900, fontSize: '0.75rem', height: 24, minWidth: 28 }} />
                        )}
                    </Box>
                    <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Real-time clinical alerts and updates
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Tooltip title="Refresh">
                        <IconButton onClick={() => fetchNotifications(false)} sx={{ color: '#64748b', bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { color: '#fff' } }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    {unreadCount > 0 && (
                        <Button variant="outlined" startIcon={markingAll ? <CircularProgress size={16} /> : <DoneAllIcon />}
                            onClick={handleMarkAllRead} disabled={markingAll}
                            sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '12px', fontWeight: 700, '&:hover': { borderColor: 'rgba(255,255,255,0.3)', color: '#fff' } }}>
                            Mark All Read
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Filter Tabs */}
            <Box sx={{ display: 'flex', gap: 1, mb: 4 }}>
                {[{ label: 'All', value: 'all' }, { label: `Unread (${unreadCount})`, value: 'unread' }].map(f => (
                    <Button key={f.value} onClick={() => setFilter(f.value)} size="small"
                        sx={{
                            px: 3, py: 1, borderRadius: '10px', fontWeight: 700,
                            bgcolor: filter === f.value ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.04)',
                            color: filter === f.value ? '#0d9488' : '#64748b',
                            border: `1px solid ${filter === f.value ? 'rgba(13,148,136,0.3)' : 'rgba(255,255,255,0.06)'}`,
                            '&:hover': { bgcolor: 'rgba(13,148,136,0.1)', color: '#0d9488' }
                        }}>
                        {f.label}
                    </Button>
                ))}
            </Box>

            {/* Notifications List */}
            <Card elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', overflow: 'hidden' }}>
                {isLoading ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}><CircularProgress sx={{ color: '#0d9488' }} /></Box>
                ) : filtered.length === 0 ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}>
                        <NotificationsIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#64748b', fontWeight: 700 }}>
                            {filter === 'unread' ? 'All caught up!' : 'No notifications'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', mt: 1 }}>
                            {filter === 'unread' ? 'No unread notifications.' : 'Clinical updates will appear here.'}
                        </Typography>
                    </Box>
                ) : (
                    filtered.map((notif, index) => {
                        const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
                        return (
                            <Box key={notif.id}
                                sx={{
                                    p: 3, display: 'flex', gap: 3, alignItems: 'flex-start',
                                    borderBottom: index < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    bgcolor: !notif.is_read ? 'rgba(99,102,241,0.03)' : 'transparent',
                                    transition: 'all 0.2s', cursor: 'pointer',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }
                                }}
                                onClick={() => {
                                    if (!notif.is_read) handleMarkRead(notif.id);
                                    if (notif.patient_id) navigate(`/patient/${notif.patient_id}`);
                                }}>
                                {/* Icon */}
                                <Box sx={{ width: 44, height: 44, borderRadius: '14px', bgcolor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
                                    {cfg.icon}
                                </Box>
                                {/* Content */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: notif.is_read ? 600 : 900, color: notif.is_read ? '#94a3b8' : '#fff' }}>
                                            {notif.title}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#475569', fontFamily: 'Space Mono', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>
                                            {timeAgo(notif.created_at)}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" sx={{ color: notif.is_read ? '#475569' : '#94a3b8', lineHeight: 1.6 }}>
                                        {notif.body}
                                    </Typography>
                                </Box>
                                {/* Unread dot */}
                                <Box sx={{ flexShrink: 0, mt: 0.5 }}>
                                    {!notif.is_read
                                        ? <FiberManualRecordIcon sx={{ fontSize: 10, color: '#6366f1' }} />
                                        : <Box sx={{ width: 10 }} />
                                    }
                                </Box>
                            </Box>
                        );
                    })
                )}
            </Card>

            <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setToast(p => ({ ...p, open: false }))} severity={toast.severity} sx={{ width: '100%', fontWeight: 'bold' }}>{toast.message}</Alert>
            </Snackbar>
        </Box>
    );
}
