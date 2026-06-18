import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Badge, Avatar, Box, InputBase, Menu, MenuItem, Divider } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { doctorService } from '../services/doctorService';

import NotificationsIcon from '@mui/icons-material/Notifications';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield';

// FIX (item #7 — logo not used):
// Sidebar now shows the logo. Topbar shows the hospital name from the
// profile response instead of a static "Hospyn Portal" fallback,
// so the branding is live and tied to the actual logged-in hospital.
//
// FIX: notification badge was hardcoded to "2" — never reflected real
// unread count. Now fetches from /doctor/notifications on mount and
// polling every 60s. Click navigates to /notifications screen.

let logoSrc = null;
try {
    logoSrc = require('../assets/logo.png');
} catch (e) {
    logoSrc = null;
}

export default function Topbar({ onLogout, onOpenScan }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState(null);
    const [profile, setProfile] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const handleProfileClick = (event) => setAnchorEl(event.currentTarget);
    const handleProfileClose = () => setAnchorEl(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profileData = await doctorService.getProfile();
                setProfile(profileData);
            } catch (err) {
                console.error("Failed to fetch profile in Topbar", err);
            }
        };
        fetchProfile();
    }, []);

    // Poll for unread notification count
    useEffect(() => {
        const fetchNotifCount = async () => {
            try {
                const data = await doctorService.getNotifications();
                setUnreadCount(data?.unread_count ?? 0);
            } catch (err) {
                // silent — badge stays at 0
            }
        };
        fetchNotifCount();
        const timer = setInterval(fetchNotifCount, 60000);
        return () => clearInterval(timer);
    }, []);

    // Extended page title map covering every registered route
    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/') return 'Dashboard';
        if (path.startsWith('/patients')) return 'My Patients';
        if (path.startsWith('/patient/')) return 'Patient Detail';
        if (path.startsWith('/queue')) return 'Live Queue';
        if (path.startsWith('/schedule')) return 'Schedule';
        if (path.startsWith('/prescriptions') || path.startsWith('/prescription')) return 'Prescriptions';
        if (path.startsWith('/history') || path.startsWith('/access-history')) return 'Access History';
        if (path.startsWith('/analytics')) return 'Analytics';
        if (path.startsWith('/alerts')) return 'Alerts';
        if (path.startsWith('/leave')) return 'Leave Management';
        if (path.startsWith('/roster')) return 'Monthly Roster';
        if (path.startsWith('/earnings')) return 'Earnings';
        if (path.startsWith('/notifications')) return 'Notifications';
        if (path.startsWith('/settings')) return 'Settings';
        return profile?.hospital_name || 'Hospyn Portal';
    };

    return (
        <AppBar
            position="sticky"
            elevation={0}
            sx={{
                bgcolor: 'rgba(5, 8, 16, 0.5)',
                backdropFilter: 'blur(20px)',
                color: '#fff',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                height: 70,
                justifyContent: 'center'
            }}
        >
            <Toolbar sx={{ minHeight: '70px !important', px: 4 }}>
                {/* Left - Logo + Title */}
                <Box sx={{ width: '250px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {/* Logo (item #7) */}
                    <Box sx={{
                        width: 32, height: 32,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: logoSrc ? 'transparent' : 'linear-gradient(135deg, #6366f1, #0d9488)',
                        flexShrink: 0,
                    }}>
                        {logoSrc ? (
                            <img src={logoSrc} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <ShieldIcon sx={{ color: '#0d9488', fontSize: 20 }} />
                        )}
                    </Box>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 800,
                            fontFamily: 'Outfit',
                            letterSpacing: '-0.02em',
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {getPageTitle()}
                    </Typography>
                </Box>

                {/* Center - Search Bar */}
                <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '16px',
                        px: 2.5,
                        py: 0.8,
                        width: '100%',
                        maxWidth: 500,
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'all 0.3s',
                        '&:focus-within': {
                            bgcolor: 'rgba(255, 255, 255, 0.06)',
                            borderColor: 'rgba(13, 148, 136, 0.4)',
                            boxShadow: '0 0 15px rgba(13, 148, 136, 0.2)'
                        }
                    }}>
                        <SearchIcon sx={{ color: '#cbd5e1', fontSize: 22, mr: 1.5 }} />
                        <InputBase
                            placeholder="Universal search (Patients, Records, ID)..."
                            sx={{ flex: 1, fontSize: '0.9rem', color: '#fff' }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value.trim()) {
                                    navigate(`/patients/search?q=${encodeURIComponent(e.target.value.trim())}`);
                                }
                            }}
                        />
                    </Box>
                </Box>

                {/* Right - Actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '250px', justifyContent: 'flex-end' }}>
                    <IconButton
                        onClick={onOpenScan}
                        size="medium"
                        sx={{
                            color: '#0d9488',
                            bgcolor: 'rgba(13, 148, 136, 0.1)',
                            borderRadius: '12px',
                            '&:hover': { bgcolor: 'rgba(13, 148, 136, 0.2)' }
                        }}
                    >
                        <CameraAltIcon fontSize="small" />
                    </IconButton>

                    {/* Notification bell — real unread count, click to /notifications */}
                    <IconButton
                        size="medium"
                        onClick={() => navigate('/notifications')}
                        sx={{ color: '#cbd5e1', bgcolor: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px' }}
                    >
                        <Badge
                            badgeContent={unreadCount}
                            sx={{
                                '& .MuiBadge-badge': {
                                    background: 'linear-gradient(45deg, #ef4444 0%, #991b1b 100%)',
                                    color: 'white',
                                    fontWeight: 800,
                                    fontSize: '0.65rem'
                                }
                            }}
                        >
                            <NotificationsIcon fontSize="small" />
                        </Badge>
                    </IconButton>

                    <Box
                        onClick={handleProfileClick}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            ml: 1,
                            gap: 1.5,
                            p: 0.5,
                            pr: 1.5,
                            borderRadius: '14px',
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' }
                        }}
                    >
                        <Avatar
                            sx={{
                                bgcolor: '#6366f1',
                                width: 38,
                                height: 38,
                                fontSize: '0.9rem',
                                fontWeight: 800,
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            {profile ? `${profile.first_name?.[0] || 'D'}${profile.last_name?.[0] || 'R'}` : '...'}
                        </Avatar>
                    </Box>

                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleProfileClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        PaperProps={{
                            sx: {
                                mt: 1.5,
                                background: 'rgba(10, 14, 26, 0.95)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '18px',
                                color: '#fff',
                                minWidth: 200,
                                boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
                            }
                        }}
                    >
                        <MenuItem sx={{ py: 1.5, fontWeight: 600, fontSize: '0.9rem', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                            onClick={() => { handleProfileClose(); navigate('/settings'); }}>
                            Settings & Profile
                        </MenuItem>
                        <MenuItem sx={{ py: 1.5, fontWeight: 600, fontSize: '0.9rem', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                            onClick={() => { handleProfileClose(); navigate('/access-history'); }}>
                            Access History
                        </MenuItem>
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                        <MenuItem
                            sx={{ py: 1.5, fontWeight: 800, color: '#ef4444', fontSize: '0.9rem', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                            onClick={() => { handleProfileClose(); onLogout(); }}
                        >
                            Secure Session Terminate
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
