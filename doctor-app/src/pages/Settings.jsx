import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Divider, Switch, Button, TextField, FormControlLabel, Avatar, Alert } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import ComputerIcon from '@mui/icons-material/Computer';
import { API_BASE_URL } from '../api';

export default function Settings() {
    const [profile, setProfile] = useState(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [twoFA, setTwoFA] = useState(true);
    const [timeout, setTimeoutVal] = useState("15");
    const [emailNotif, setEmailNotif] = useState(true);
    const [smsNotif, setSmsNotif] = useState(false);
    
    // Status notifications
    const [alertMsg, setAlertMsg] = useState(null);
    const [alertSev, setAlertSev] = useState('success');

    // Phone OTP Flow States
    const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [otpStep, setOtpStep] = useState(1); // 1 = enter phone, 2 = enter otp
    const [phoneOtp, setPhoneOtp] = useState('');
    const [phoneLoading, setPhoneLoading] = useState(false);
    const [devOtpInfo, setDevOtpInfo] = useState('');

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
                setFirstName(data.first_name || '');
                setLastName(data.last_name || '');
                setSpecialty(data.specialty || '');
                setEmailNotif(data.email_notifications_enabled ?? true);
                setSmsNotif(data.sms_notifications_enabled ?? false);
                setTimeoutVal(String(data.session_timeout_minutes ?? 15));
            }
        } catch (err) {
            console.error("Failed to fetch profile in Settings", err);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleSaveProfile = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/doctor/profile`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    specialty: specialty
                })
            });
            if (res.ok) {
                setAlertMsg("Profile updated successfully!");
                setAlertSev("success");
                fetchProfile();
            } else {
                const err = await res.json();
                setAlertMsg(err.detail || "Failed to update profile.");
                setAlertSev("error");
            }
        } catch (e) {
            setAlertMsg("Network error occurred.");
            setAlertSev("error");
        }
    };

    const handleUpdatePreferences = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/doctor/settings`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email_notifications_enabled: emailNotif,
                    sms_notifications_enabled: smsNotif,
                    session_timeout_minutes: parseInt(timeout)
                })
            });
            if (res.ok) {
                setAlertMsg("Notification & Session timeout preferences saved.");
                setAlertSev("success");
                fetchProfile();
            } else {
                setAlertMsg("Failed to update preferences.");
                setAlertSev("error");
            }
        } catch (e) {
            setAlertMsg("Network error occurred.");
            setAlertSev("error");
        }
    };

    const handleSendPhoneOtp = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        setPhoneLoading(true);
        setDevOtpInfo('');
        try {
            const res = await fetch(`${API_BASE_URL}/doctor/send-phone-otp`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phone_number: newPhone })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setOtpStep(2);
                if (data.dev_otp) {
                    setDevOtpInfo(`[DEV FALLBACK] Received verification code: ${data.dev_otp}`);
                }
            } else {
                setAlertMsg(data.detail || "Failed to send OTP.");
                setAlertSev("error");
            }
        } catch (e) {
            setAlertMsg("Network error sending OTP.");
            setAlertSev("error");
        } finally {
            setPhoneLoading(false);
        }
    };

    const handleVerifyPhoneOtp = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        setPhoneLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/doctor/verify-phone-otp`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phone_number: newPhone, otp: phoneOtp })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setAlertMsg("Phone number successfully updated.");
                setAlertSev("success");
                setIsPhoneModalOpen(false);
                fetchProfile();
            } else {
                setAlertMsg(data.detail || "Invalid verification OTP code.");
                setAlertSev("error");
            }
        } catch (e) {
            setAlertMsg("Network error verifying OTP.");
            setAlertSev("error");
        } finally {
            setPhoneLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 8 }}>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#fff' }}>
                    Settings & Security
                </Typography>
                <Typography variant="body1" sx={{ color: '#94a3b8', mt: 0.5 }}>
                    Manage your professional profile and cryptographic keys.
                </Typography>
            </Box>

            {alertMsg && (
                <Alert severity={alertSev} sx={{ mb: 4, borderRadius: 2 }} onClose={() => setAlertMsg(null)}>
                    {alertMsg}
                </Alert>
            )}

            <Grid container spacing={4}>

                {/* Left Column: Profile & Notifications */}
                <Grid item xs={12} md={7}>

                    {/* Professional Profile */}
                    <Card elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(30, 41, 59, 0.4)', borderRadius: 4, mb: 4 }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff' }}>Professional Profile</Typography>
                        </Box>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                                <Avatar sx={{ width: 80, height: 80, bgcolor: '#0d9488', fontSize: '2rem', mr: 3 }}>
                                    {profile ? `${firstName?.[0] || ''}${lastName?.[0] || ''}` : 'SM'}
                                </Avatar>
                                <Box>
                                    <Button variant="outlined" size="small" sx={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', mb: 1 }}>Change Photo</Button>
                                    <Typography variant="caption" display="block" color="#64748b">JPG, GIF or PNG. 1MB max.</Typography>
                                </Box>
                            </Box>

                            <Grid container spacing={3}>
                                <Grid item xs={12}>
                                    <TextField 
                                        fullWidth 
                                        label="Hospyn ID" 
                                        value={profile?.hospyn_id || "Loading..."} 
                                        size="small" 
                                        disabled 
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: '#94a3b8' } }}
                                        helperText="Hospyn ID is permanently locked and cannot be changed."
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField 
                                        fullWidth 
                                        label="First Name" 
                                        value={firstName} 
                                        onChange={(e) => setFirstName(e.target.value)} 
                                        size="small" 
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: '#fff' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField 
                                        fullWidth 
                                        label="Last Name" 
                                        value={lastName} 
                                        onChange={(e) => setLastName(e.target.value)} 
                                        size="small" 
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: '#fff' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField 
                                        fullWidth 
                                        label="Medical License ID" 
                                        value={profile?.license_number || "Loading..."} 
                                        size="small" 
                                        disabled 
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: '#94a3b8' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField 
                                        fullWidth 
                                        label="Primary Clinic" 
                                        value={profile?.hospital_name || "Loading..."} 
                                        size="small" 
                                        disabled 
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: '#94a3b8' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField 
                                        fullWidth 
                                        label="Specialization" 
                                        value={specialty} 
                                        onChange={(e) => setSpecialty(e.target.value)} 
                                        size="small" 
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ input: { color: '#fff' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField 
                                            fullWidth 
                                            label="Mobile Number" 
                                            value={profile?.phone_number || "Not Set"} 
                                            size="small" 
                                            disabled 
                                            InputLabelProps={{ shrink: true }}
                                            sx={{ input: { color: '#94a3b8' } }}
                                        />
                                        <Button 
                                            variant="outlined" 
                                            color="primary" 
                                            onClick={() => { setOtpStep(1); setNewPhone(''); setPhoneOtp(''); setDevOtpInfo(''); setIsPhoneModalOpen(true); }}
                                            sx={{ borderColor: '#0d9488', color: '#0d9488' }}
                                        >
                                            Change
                                        </Button>
                                    </Box>
                                </Grid>
                            </Grid>

                            <Box sx={{ mt: 3, textAlign: 'right' }}>
                                <Button onClick={handleSaveProfile} variant="contained" sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' }, fontWeight: 'bold' }}>Save Profile</Button>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Notifications */}
                    <Card elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(30, 41, 59, 0.4)', borderRadius: 4 }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff' }}>Notification Preferences</Typography>
                        </Box>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#fff' }}>Critical Alerts (Drug interactions, Revocations)</Typography>
                                <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>These are mandatory and appear in-app. Choose secondary delivery channels:</Typography>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <FormControlLabel
                                        control={<Switch checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} color="primary" />}
                                        label={<Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>Email Notification ({profile?.email || 'sarah.m@example.com'})</Typography>}
                                    />
                                    <FormControlLabel
                                        control={<Switch checked={smsNotif} onChange={(e) => setSmsNotif(e.target.checked)} color="primary" />}
                                        label={<Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>SMS Notification ({profile?.phone_number || 'No Phone set'})</Typography>}
                                    />
                                </Box>
                            </Box>
                            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.05)' }} />
                            <Box sx={{ textAlign: 'right' }}>
                                <Button onClick={handleUpdatePreferences} variant="outlined" sx={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 'bold' }}>Update Preferences</Button>
                            </Box>
                        </CardContent>
                    </Card>

                </Grid>

                {/* Right Column: Security */}
                <Grid item xs={12} md={5}>

                    {/* Access Management */}
                    <Card elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(30, 41, 59, 0.4)', borderRadius: 4, mb: 4 }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <SecurityIcon sx={{ color: '#ef4444' }} />
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff' }}>Access & Security</Typography>
                        </Box>
                        <CardContent sx={{ p: 3 }}>

                            <Box sx={{ mb: 4 }}>
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#fff', mb: 1 }}>Two-Factor Authentication (2FA)</Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>Mandatory for viewing patient records.</Typography>
                                <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LockIcon sx={{ color: '#0d9488', fontSize: 20 }} />
                                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#fff' }}>Authenticator App (Enabled)</Typography>
                                    </Box>
                                    <Button size="small" color="error" variant="text" sx={{ fontWeight: 'bold' }}>Reset</Button>
                                </Box>
                            </Box>

                            <Box sx={{ mb: 4 }}>
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#fff', mb: 1 }}>Session Idle Timeout</Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>Auto-lock app when inactive for specified minutes.</Typography>
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    value={timeout}
                                    onChange={(e) => setTimeoutVal(e.target.value)}
                                    SelectProps={{ native: true }}
                                    sx={{ select: { color: '#fff', bgcolor: 'transparent' } }}
                                >
                                    <option value="5" style={{ background: '#1e293b', color: '#fff' }}>5 Minutes</option>
                                    <option value="15" style={{ background: '#1e293b', color: '#fff' }}>15 Minutes</option>
                                    <option value="30" style={{ background: '#1e293b', color: '#fff' }}>30 Minutes (Max)</option>
                                </TextField>
                            </Box>

                            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.05)' }} />

                            <Button variant="outlined" color="error" fullWidth sx={{ fontWeight: 'bold', mb: 1, borderColor: '#ef4444' }}>
                                Force Logout All Devices
                            </Button>

                        </CardContent>
                    </Card>

                    {/* Security Log */}
                    <Card elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(30, 41, 59, 0.4)', borderRadius: 4 }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff' }}>Recent Login Log</Typography>
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

            {/* Phone Verification Modal */}
            {isPhoneModalOpen && (
                <Box sx={{ position: 'fixed', inset: 0, zIndex: 9999, bgcolor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <Card sx={{ w: '100%', maxWidth: 400, p: 3, borderRadius: 3, bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Typography variant="h6" fontWeight="bold" mb={2} color="#fff">Update Mobile Number</Typography>
                        {otpStep === 1 ? (
                            <>
                                <Typography variant="body2" color="#94a3b8" mb={3}>
                                    Enter your new mobile number. We will send an OTP to verify it.
                                </Typography>
                                <TextField 
                                    fullWidth 
                                    label="New Mobile Number" 
                                    value={newPhone} 
                                    onChange={(e) => setNewPhone(e.target.value)} 
                                    sx={{ mb: 3, input: { color: '#fff' } }}
                                    InputLabelProps={{ shrink: true }}
                                    placeholder="+919876543210"
                                />
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                    <Button onClick={() => setIsPhoneModalOpen(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
                                    <Button variant="contained" onClick={handleSendPhoneOtp} disabled={!newPhone || phoneLoading} sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' } }}>
                                        {phoneLoading ? 'Sending...' : 'Send OTP'}
                                    </Button>
                                </Box>
                            </>
                        ) : (
                            <>
                                <Typography variant="body2" color="#94a3b8" mb={3}>
                                    Enter the 6-digit OTP sent to {newPhone}.
                                </Typography>
                                {devOtpInfo && (
                                    <Typography variant="caption" display="block" sx={{ color: '#f59e0b', bgcolor: 'rgba(245,158,11,0.1)', p: 1.5, borderRadius: 1.5, mb: 2, border: '1px solid rgba(245,158,11,0.2)', fontFamily: 'monospace' }}>
                                        {devOtpInfo}
                                    </Typography>
                                )}
                                <TextField 
                                    fullWidth 
                                    label="6-Digit OTP" 
                                    value={phoneOtp} 
                                    onChange={(e) => setPhoneOtp(e.target.value)} 
                                    sx={{ mb: 3, input: { color: '#fff' } }}
                                    InputLabelProps={{ shrink: true }}
                                    placeholder="Enter OTP"
                                />
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                    <Button onClick={() => setIsPhoneModalOpen(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
                                    <Button variant="contained" onClick={handleVerifyPhoneOtp} disabled={!phoneOtp || phoneLoading} sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' } }}>
                                        {phoneLoading ? 'Verifying...' : 'Verify & Update'}
                                    </Button>
                                </Box>
                            </>
                        )}
                    </Card>
                </Box>
            )}
        </Box>
    );
}

const LogItem = ({ device, loc, date, active }) => (
    <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.03)', '&:last-child': { borderBottom: 'none' }, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ComputerIcon sx={{ color: '#94a3b8' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#fff' }}>
                {device} {active && <Typography component="span" variant="caption" sx={{ color: '#0d9488', fontWeight: 'bold', ml: 1, bgcolor: 'rgba(13, 148, 136, 0.1)', px: 1, borderRadius: 1 }}>Current</Typography>}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
                {loc} • {date}
            </Typography>
        </Box>
    </Box>
);

