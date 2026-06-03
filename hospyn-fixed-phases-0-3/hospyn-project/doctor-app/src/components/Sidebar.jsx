import React, { useState } from 'react';
import {
    Box, Typography, Tooltip, IconButton, Avatar, Divider
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import QueueIcon from '@mui/icons-material/Queue';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import MedicationIcon from '@mui/icons-material/Medication';
import BarChartIcon from '@mui/icons-material/BarChart';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SettingsIcon from '@mui/icons-material/Settings';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ShieldIcon from '@mui/icons-material/Shield';

const NAV_SECTIONS = [
    {
        label: 'CLINICAL',
        items: [
            { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
            { label: 'Live Queue', path: '/queue', icon: <QueueIcon /> },
            { label: 'Patients', path: '/patients', icon: <PeopleIcon /> },
            { label: 'Prescriptions', path: '/prescriptions', icon: <MedicationIcon /> },
            { label: 'Schedule', path: '/schedule', icon: <CalendarTodayIcon /> },
        ]
    },
    {
        label: 'INSIGHTS',
        items: [
            { label: 'Analytics', path: '/analytics', icon: <BarChartIcon /> },
            { label: 'Earnings', path: '/earnings', icon: <AccountBalanceWalletIcon /> },
            { label: 'Access History', path: '/history', icon: <HistoryIcon /> },
        ]
    },
    {
        label: 'MANAGE',
        items: [
            { label: 'Notifications', path: '/notifications', icon: <NotificationsIcon /> },
            { label: 'Alerts', path: '/alerts', icon: <WarningAmberIcon /> },
            { label: 'Leave', path: '/leave', icon: <EventBusyIcon /> },
            { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
        ]
    }
];

export default function Sidebar({ onOpenScan }) {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <Box sx={{
            width: 72,
            height: '100vh',
            bgcolor: 'rgba(5, 8, 16, 0.95)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(40px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 3,
            gap: 0,
            flexShrink: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            '&::-webkit-scrollbar': { display: 'none' },
            zIndex: 100,
        }}>
            {/* Logo */}
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{
                    width: 40, height: 40,
                    background: 'linear-gradient(135deg, #6366f1, #0d9488)',
                    borderRadius: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
                }}>
                    <ShieldIcon sx={{ color: 'white', fontSize: 22 }} />
                </Box>
            </Box>

            {/* Scan QR */}
            <Tooltip title="Scan Patient QR" placement="right">
                <IconButton onClick={onOpenScan} sx={{
                    mb: 3, width: 44, height: 44, bgcolor: 'rgba(13,148,136,0.1)',
                    border: '1px solid rgba(13,148,136,0.3)', borderRadius: '14px',
                    color: '#0d9488',
                    '&:hover': { bgcolor: 'rgba(13,148,136,0.2)', transform: 'scale(1.1)' },
                    transition: 'all 0.2s'
                }}>
                    <QrCodeScannerIcon sx={{ fontSize: 20 }} />
                </IconButton>
            </Tooltip>

            <Divider sx={{ width: 36, borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

            {/* Navigation Sections */}
            {NAV_SECTIONS.map((section) => (
                <Box key={section.label} sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" sx={{
                        color: 'rgba(255,255,255,0.12)', fontWeight: 900, fontSize: '0.5rem',
                        letterSpacing: 2, mb: 1.5, textAlign: 'center', display: 'block'
                    }}>
                        {section.label}
                    </Typography>
                    {section.items.map((item) => {
                        const active = isActive(item.path);
                        return (
                            <Tooltip key={item.path} title={item.label} placement="right">
                                <IconButton
                                    onClick={() => navigate(item.path)}
                                    sx={{
                                        mb: 0.5, width: 44, height: 44, borderRadius: '14px',
                                        color: active ? '#fff' : 'rgba(255,255,255,0.35)',
                                        bgcolor: active ? 'rgba(99,102,241,0.2)' : 'transparent',
                                        border: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                                        boxShadow: active ? '0 4px 15px rgba(99,102,241,0.2)' : 'none',
                                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                        '&:hover': {
                                            bgcolor: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                                            color: '#fff',
                                            transform: 'scale(1.08)',
                                        }
                                    }}>
                                    {React.cloneElement(item.icon, { sx: { fontSize: 20 } })}
                                </IconButton>
                            </Tooltip>
                        );
                    })}
                    <Divider sx={{ width: 36, borderColor: 'rgba(255,255,255,0.04)', my: 1.5 }} />
                </Box>
            ))}

            {/* Bottom: Profile Avatar */}
            <Box sx={{ mt: 'auto' }}>
                <Tooltip title="Profile" placement="right">
                    <Avatar onClick={() => navigate('/settings')} sx={{
                        width: 36, height: 36, cursor: 'pointer',
                        bgcolor: 'rgba(99,102,241,0.15)',
                        border: '1px solid rgba(99,102,241,0.3)',
                        color: '#6366f1', fontSize: '0.85rem', fontWeight: 900,
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: 'rgba(99,102,241,0.25)', transform: 'scale(1.1)' }
                    }}>
                        Dr
                    </Avatar>
                </Tooltip>
            </Box>
        </Box>
    );
}
