import React from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Typography, Box, Divider, Badge, Button } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { doctorService } from '../services/doctorService';

// Icons
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import MedicationIcon from '@mui/icons-material/Medication';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import BarChartIcon from '@mui/icons-material/BarChart';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const drawerWidth = 240;

export default function Sidebar({ onOpenScan }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [profile, setProfile] = React.useState(null);
    const [stats, setStats] = React.useState({
        patients_count: 0,
        schedule_count: 0,
        alerts_count: 0,
        pending_rx_count: 0
    });

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Profile and Stats concurrently
                const [profileData, statsData] = await Promise.all([
                    doctorService.getProfile(),
                    doctorService.getStats()
                ]);
                
                setProfile(profileData);
                setStats(statsData);
            } catch (err) {
                console.error("Sidebar fetch error:", err);
            }
        };
        fetchData();
    }, []);

    // Grouped Menu Items
    const menuSections = [
        {
            title: 'Main',
            items: [
                { text: 'Dashboard', icon: <HomeIcon />, path: '/' },
                { text: 'My Patients', icon: <PeopleIcon />, path: '/patients', badge: stats.patients_count },
                { text: 'Schedule', icon: <CalendarMonthIcon />, path: '/schedule', badge: stats.schedule_count },
            ]
        },
        {
            title: 'Patient Access',
            items: [
                { text: 'Scan QR / Enter ID', icon: <QrCodeScannerIcon />, action: onOpenScan },
                { text: 'Records Shared', icon: <FolderSharedIcon />, path: '/history' },
            ]
        },
        {
            title: 'Insights',
            items: [
                { text: 'Analytics', icon: <BarChartIcon />, path: '/analytics' },
                { text: 'Alerts', icon: <NotificationsIcon />, path: '/alerts', badge: stats.alerts_count, badgeColor: 'error' },
            ]
        },
        {
            title: 'Account',
            items: [
                { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
            ]
        }
    ];

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: drawerWidth,
                    boxSizing: 'border-box',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    backdropFilter: 'blur(30px)',
                    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                    margin: '10px 0 10px 10px',
                    height: 'calc(100% - 20px)',
                    borderRadius: '24px',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)'
                },
            }}
        >
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ 
                        width: 44, 
                        height: 44, 
                        background: 'linear-gradient(135deg, #0f172a 0%, #050810 100%)', 
                        borderRadius: '14px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        mr: 1.5,
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}>
                        <Typography sx={{ color: '#fff', fontWeight: 900, fontFamily: 'Outfit', fontSize: '1.6rem', letterSpacing: '-0.05em' }}>H</Typography>
                    </Box>
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            fontWeight: 900, 
                            fontFamily: 'Outfit',
                            letterSpacing: '-0.04em',
                            color: '#fff',
                            textShadow: '0 2px 10px rgba(255,255,255,0.1)'
                        }}
                    >
                        Hospyn
                    </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b', mb: 3, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Inter' }}>
                    Clinical Portal
                </Typography>

                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    width: '100%', 
                    gap: 1.5, 
                    bgcolor: 'rgba(255,255,255,0.03)', 
                    p: 2, 
                    borderRadius: '18px',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <Box sx={{ position: 'relative' }}>
                        <Box sx={{ 
                            width: 44, 
                            height: 44, 
                            borderRadius: '14px', 
                            background: 'linear-gradient(45deg, #3b82f6 0%, #1d4ed8 100%)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}>
                            <Typography fontWeight="bold" color="white" sx={{ fontSize: '1rem' }}>
                                {profile ? `${profile.first_name?.[0] || 'D'}${profile.last_name?.[0] || 'R'}` : 'DR'}
                            </Typography>
                        </Box>
                        <Box sx={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, bgcolor: '#22c55e', borderRadius: '50%', border: '2.5px solid #050810' }} />
                    </Box>
                    <Box sx={{ textAlign: 'left', flex: 1, overflow: 'hidden' }}>
                        <Typography variant="subtitle2" color="white" fontWeight="800" noWrap sx={{ fontSize: '0.85rem' }}>
                            {profile ? `Dr. ${profile.last_name}` : 'Admin'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }} noWrap>
                            {profile ? profile.specialty : 'Verified Lead'}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mx: 2 }} />

            <List sx={{ px: 1.5, flexGrow: 1, overflowY: 'auto', mt: 2 }}>
                {menuSections.map((section, idx) => (
                    <Box key={idx} sx={{ mb: 3 }}>
                        <Typography variant="caption" sx={{ color: '#334155', px: 2, display: 'block', mb: 1.5, fontWeight: 800, letterSpacing: '0.05em' }}>
                            {section.title.toUpperCase()}
                        </Typography>
                        {section.items.map((item) => (
                            <ListItem
                                button
                                key={item.text}
                                onClick={() => item.action ? item.action() : navigate(item.path)}
                                sx={{
                                    mb: 0.8,
                                    borderRadius: '14px',
                                    py: 1.2,
                                    backgroundColor: location.pathname === item.path ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                                    border: location.pathname === item.path ? '1px solid rgba(13, 148, 136, 0.2)' : '1px solid transparent',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        transform: 'translateX(4px)'
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ color: location.pathname === item.path ? '#0d9488' : '#64748b', minWidth: 40 }}>
                                    {item.badge ? (
                                        <Badge 
                                            badgeContent={item.badge} 
                                            color={item.badgeColor || "primary"} 
                                            sx={{ 
                                                '& .MuiBadge-badge': { 
                                                    right: -3, 
                                                    top: 3, 
                                                    background: item.badgeColor === 'error' ? '#ef4444' : '#0d9488',
                                                    boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                                                } 
                                            }}
                                        >
                                            {item.icon}
                                        </Badge>
                                    ) : item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        variant: 'caption',
                                        fontWeight: location.pathname === item.path ? 700 : 500,
                                        color: location.pathname === item.path ? '#fff' : '#94a3b8',
                                        letterSpacing: '0.02em',
                                        sx: { fontSize: '0.8rem' }
                                    }}
                                />
                            </ListItem>
                        ))}
                    </Box>
                ))}
            </List>

            <Box sx={{ p: 2.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Button
                    fullWidth
                    color="error"
                    variant="contained"
                    startIcon={<WarningAmberIcon />}
                    sx={{ 
                        justifyContent: 'center', 
                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444', 
                        fontWeight: 800,
                        borderRadius: '14px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        py: 1.2,
                        '&:hover': {
                            bgcolor: '#ef4444',
                            color: 'white',
                            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
                        }
                    }}
                >
                    Emergency Rescue
                </Button>
            </Box>
        </Drawer>
    );
}
