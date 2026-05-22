import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Divider, Switch, Button, TextField, FormControlLabel, Avatar } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import ComputerIcon from '@mui/icons-material/Computer';
import { API_BASE_URL } from '../api';

export default function Settings() {
    const [profile, setProfile] = useState(null);
    const [twoFA, setTwoFA] = useState(true);
    const [timeout, setTimeout] = useState("15");
    const [emailNotif, setEmailNotif] = useState(true);
    const [smsNotif, setSmsNotif] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            try {
                const res = await fetch(`${API_BASE_URL}/doctor/profile/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                }
            } catch (err) {
                console.error("Failed to fetch profile in Settings", err);
            }
        };
        fetchProfile();
    }, []);

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 8 }}>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#1f2937' }}>
                    Settings & Security
                </Typography>
                <Typography variant="body1" sx={{ color: '#6b7280', mt: 0.5 }}>
                    Manage your professional profile and cryptographic keys.
                </Typography>
            </Box>

            <Grid container spacing={4}>

                {/* Left Column: Profile & Notifications */}
                <Grid item xs={12} md={7}>

                    {/* Professional Profile */}
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, mb: 4 }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937' }}>Professional Profile</Typography>
                        </Box>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                                <Avatar sx={{ width: 80, height: 80, bgcolor: '#0d9488', fontSize: '2rem', mr: 3 }}>
                                    {profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}` : 'SM'}
                                </Avatar>
                                <Box>
                                    <Button variant="outlined" size="small" sx={{ color: '#4b5563', borderColor: '#d1d5db', mb: 1 }}>Change Photo</Button>
                                    <Typography variant="caption" display="block" color="text.secondary">JPG, GIF or PNG. 1MB max.</Typography>
                                </Box>
                            </Box>

                            <Grid container spacing={3}>
                                <Grid item xs={12} sm={6}>
                                    <TextField fullWidth label="Full Name" value={profile ? `Dr. ${profile.first_name || ''} ${profile.last_name || ''}`.trim() : "Loading..."} size="small" disabled={!profile} />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField fullWidth label="Medical License ID" value={profile?.license_number || "Loading..."} size="small" disabled />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField fullWidth label="Primary Clinic" value={profile?.hospital_name || "Loading..."} size="small" disabled={!profile} />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField fullWidth label="Specialization" value={profile?.specialty || "Loading..."} size="small" disabled={!profile} />
                                </Grid>
                            </Grid>

                            <Box sx={{ mt: 3, textAlign: 'right' }}>
                                <Button variant="contained" sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' }, fontWeight: 'bold' }}>Save Profile</Button>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Notifications */}
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937' }}>Notification Preferences</Typography>
                        </Box>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#111827' }}>Critical Alerts (Drug interactions, Revocations)</Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280', mb: 2 }}>These are mandatory and appear in-app. Choose secondary delivery channels:</Typography>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <FormControlLabel
                                        control={<Switch checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} color="primary" />}
                                        label={<Typography variant="body2" sx={{ color: '#374151', fontWeight: 500 }}>Email Notification (sarah.m@example.com)</Typography>}
                                    />
                                    <FormControlLabel
                                        control={<Switch checked={smsNotif} onChange={(e) => setSmsNotif(e.target.checked)} color="primary" />}
                                        label={<Typography variant="body2" sx={{ color: '#374151', fontWeight: 500 }}>SMS Notification (+91 98*** ***21)</Typography>}
                                    />
                                </Box>
                            </Box>
                            <Divider sx={{ my: 3 }} />
                            <Box sx={{ textAlign: 'right' }}>
                                <Button variant="outlined" sx={{ color: '#4b5563', borderColor: '#d1d5db', fontWeight: 'bold' }}>Update Preferences</Button>
                            </Box>
                        </CardContent>
                    </Card>

                </Grid>

                {/* Right Column: Security */}
                <Grid item xs={12} md={5}>

                    {/* Access Management */}
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, mb: 4 }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <SecurityIcon sx={{ color: '#ef4444' }} />
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937' }}>Access & Security</Typography>
                        </Box>
                        <CardContent sx={{ p: 3 }}>

                            <Box sx={{ mb: 4 }}>
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#111827', mb: 1 }}>Two-Factor Authentication (2FA)</Typography>
                                <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2 }}>Mandatory for viewing patient records.</Typography>
                                <Box sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LockIcon sx={{ color: '#0d9488', fontSize: 20 }} />
                                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#374151' }}>Authenticator App (Enabled)</Typography>
                                    </Box>
                                    <Button size="small" color="error" variant="text" sx={{ fontWeight: 'bold' }}>Reset</Button>
                                </Box>
                            </Box>

                            <Box sx={{ mb: 4 }}>
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#111827', mb: 1 }}>Session Idle Timeout</Typography>
                                <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2 }}>Auto-lock app when inactive for specified minutes.</Typography>
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    value={timeout}
                                    onChange={(e) => setTimeout(e.target.value)}
                                    SelectProps={{ native: true }}
                                >
                                    <option value="5">5 Minutes</option>
                                    <option value="15">15 Minutes</option>
                                    <option value="30">30 Minutes (Max)</option>
                                </TextField>
                            </Box>

                            <Divider sx={{ my: 3 }} />

                            <Button variant="outlined" color="error" fullWidth sx={{ fontWeight: 'bold', mb: 1 }}>
                                Force Logout All Devices
                            </Button>

                        </CardContent>
                    </Card>

                    {/* Security Log */}
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937' }}>Recent Login Log</Typography>
                        </Box>
                        <Box sx={{ p: 0 }}>
                            <LogItem
                                device="Windows PC — Chrome"
                                loc="Mumbai, India"
                                date="Today, 09:15 AM"
                                active={true}
                            />
                            <LogItem
                                device="MacBook Pro — Safari"
                                loc="Mumbai, India"
                                date="Yesterday, 04:30 PM"
                                active={false}
                            />
                        </Box>
                    </Card>

                </Grid>
            </Grid>

        </Box>
    );
}

const LogItem = ({ device, loc, date, active }) => (
    <Box sx={{ p: 2.5, borderBottom: '1px solid #e5e7eb', '&:last-child': { borderBottom: 'none' }, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ComputerIcon sx={{ color: '#6b7280' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#111827' }}>
                {device} {active && <Typography component="span" variant="caption" sx={{ color: '#0d9488', fontWeight: 'bold', ml: 1, bgcolor: '#ccfbf1', px: 1, borderRadius: 1 }}>Current</Typography>}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
                {loc} • {date}
            </Typography>
        </Box>
    </Box>
);
