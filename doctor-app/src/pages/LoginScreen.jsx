import React, { useState } from 'react';
import { Container, Typography, TextField, Button, Box, Paper, Grid, Divider, Select, MenuItem, FormControl, InputLabel, Alert, Tabs, Tab, RadioGroup, FormControlLabel, Radio, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import { API_BASE_URL } from '../api';

export default function LoginScreen() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    const [loginMode, setLoginMode] = useState('otp'); // 'otp' | 'password'
    const [identifier, setIdentifier] = useState('');
    const [passwordOrOtp, setPasswordOrOtp] = useState('');
    const [otpChannel, setOtpChannel] = useState('sms'); // 'sms' | 'email'
    const [otpSent, setOtpSent] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleSendOTP = async () => {
        setIsLoading(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
            const response = await fetch(`${API_BASE_URL}/doctor/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    identifier, 
                    method: identifier.includes('@') ? 'email' : 'sms' 
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Failed to send OTP');
            setOtpSent(true);
            setSuccessMsg(`OTP sent to your ${otpChannel === 'sms' ? 'phone' : 'email'}.`);
        } catch (error) {
            setErrorMsg(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');

        try {
            const formData = new URLSearchParams();
            formData.append('identifier', identifier);
            formData.append('password_or_otp', passwordOrOtp);
            formData.append('is_otp', loginMode === 'otp' ? 'true' : 'false');

            const response = await fetch(`${API_BASE_URL}/doctor/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });

            const data = await response.json();

            if (!response.ok) {
                const errorDetail = typeof data.detail === 'string'
                    ? data.detail
                    : (Array.isArray(data.detail) ? data.detail.map(e => e.msg).join(', ') : JSON.stringify(data.detail));
                throw new Error(errorDetail || 'Login failed.');
            }

            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('token', data.access_token);
            window.location.href = '/';
        } catch (error) {
            setErrorMsg(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', background: '#050810', position: 'relative', overflow: 'hidden' }}>
            {/* Background Grain/Noise or Subtle Glows */}
            <Box sx={{ position: 'absolute', top: '-10%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)', filter: 'blur(100px)', zIndex: 0 }} />
            <Box sx={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(13, 148, 136, 0.1) 0%, transparent 70%)', filter: 'blur(100px)', zIndex: 0 }} />

            <Grid container sx={{ zIndex: 1 }}>
                {/* Branding Side */}
                <Grid item xs={12} md={6} sx={{
                    background: 'transparent',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    p: 8,
                    justifyContent: 'center',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                        <Box sx={{ 
                            width: 72, 
                            height: 72, 
                            mr: 3, 
                            borderRadius: '24px', 
                            overflow: 'hidden', 
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                        }}>
                            <img src="./logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </Box>
                        <Box>
                            <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'Outfit', letterSpacing: '-2px', lineHeight: 1 }}>Hospyn</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0d9488', fontFamily: 'Outfit', letterSpacing: '4px', textTransform: 'uppercase', mt: 0.5 }}>Clinical Terminal</Typography>
                        </Box>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 300, color: '#94a3b8', maxWidth: 500, fontFamily: 'Inter', mb: 6, lineHeight: 1.4 }}>
                        The intelligence layer for <span style={{ color: '#fff', fontWeight: 700 }}>precision medicine</span>. Restricted access for authorized practitioners.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 3, maxWidth: 600 }}>
                        <Box sx={{ p: 3, background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ color: '#6366F1', fontWeight: 900, mb: 1, letterSpacing: 1 }}>CRYPTO-SHIELD</Typography>
                            <Typography variant="body2" color="#64748b" sx={{ lineHeight: 1.6 }}>Military-grade hardware-backed session encryption.</Typography>
                        </Box>
                        <Box sx={{ p: 3, background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 900, mb: 1, letterSpacing: 1 }}>Hospyn CORE</Typography>
                            <Typography variant="body2" color="#64748b" sx={{ lineHeight: 1.6 }}>Real-time synchronization with the Global Health Network.</Typography>
                        </Box>
                    </Box>
                </Grid>

                {/* Login Form Side */}
                <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                    <Container maxWidth="xs">
                        <Paper elevation={0} sx={{ 
                            p: 6, 
                            borderRadius: '32px', 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            backdropFilter: 'blur(40px)', 
                            border: '1px solid rgba(255, 255, 255, 0.05)', 
                            color: 'white',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}>
                            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: '#FFFFFF', fontFamily: 'Outfit' }}>Personnel Login</Typography>
                            <Typography variant="body1" sx={{ mb: 5, color: '#64748b', fontWeight: 500 }}>
                                Initialize secure clinical session.{" "}
                                <span style={{ color: '#0d9488', fontWeight: 700 }}>Demo: doctor@hospyn.com / Hospyn123!</span>
                            </Typography>

                            <Tabs
                                value={loginMode}
                                onChange={(e, val) => { setLoginMode(val); setOtpSent(false); setErrorMsg(''); }}
                                variant="fullWidth"
                                sx={{ 
                                    mb: 4, 
                                    bgcolor: 'rgba(255, 255, 255, 0.02)', 
                                    borderRadius: '14px', 
                                    p: 0.5, 
                                    minHeight: 48,
                                    '& .MuiTabs-indicator': { height: '100%', borderRadius: '10px', zIndex: 0, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' },
                                    '& .MuiTab-root': { color: '#64748b', zIndex: 1, minHeight: 48, fontWeight: 700, textTransform: 'none', fontSize: '0.9rem' },
                                    '& .Mui-selected': { color: '#FFFFFF !important' }
                                }}
                            >
                                <Tab label="Token Verification" value="otp" />
                                <Tab label="Global Password" value="password" />
                            </Tabs>

                            <form onSubmit={handleLogin}>
                                {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px', bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{errorMsg}</Alert>}
                                {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px', bgcolor: 'rgba(20, 184, 166, 0.1)', color: '#2dd4bf', border: '1px solid rgba(20, 184, 166, 0.2)' }}>{successMsg}</Alert>}

                                <TextField
                                    fullWidth
                                    label="Practitioner Identity (ID / Email)"
                                    variant="outlined"
                                    sx={{ 
                                        mb: 3,
                                        '& .MuiOutlinedInput-root': { 
                                            color: 'white', 
                                            bgcolor: 'rgba(255,255,255,0.02)', 
                                            borderRadius: '16px', 
                                            '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' }, 
                                            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, 
                                            '&.Mui-focused fieldset': { borderColor: '#0d9488' } 
                                        },
                                        '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 600 },
                                        '& .MuiInputLabel-root.Mui-focused': { color: '#0d9488' },
                                    }}
                                    required
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    InputProps={{
                                        startAdornment: identifier.includes('@') ? <EmailIcon sx={{ mr: 1.5, color: '#64748b' }} /> : <SmartphoneIcon sx={{ mr: 1.5, color: '#64748b' }} />
                                    }}
                                />

                                {loginMode === 'otp' ? (
                                    <>
                                        {!otpSent ? (
                                            <Box sx={{ mb: 3 }}>
                                                <Typography variant="caption" sx={{ mb: 1.5, display: 'block', color: '#64748b', fontWeight: 800, letterSpacing: 1 }}>SELECT CHANNEL</Typography>
                                                <RadioGroup row value={otpChannel} onChange={(e) => setOtpChannel(e.target.value)} sx={{ mb: 2 }}>
                                                    <FormControlLabel
                                                        value="sms"
                                                        control={<Radio size="small" sx={{ color: '#334155', '&.Mui-checked': { color: '#0d9488' } }} />}
                                                        label={<Typography variant="body2" sx={{ fontWeight: 600, color: '#94a3b8' }}>Secure SMS</Typography>}
                                                    />
                                                    <FormControlLabel
                                                        value="email"
                                                        control={<Radio size="small" sx={{ color: '#334155', '&.Mui-checked': { color: '#0d9488' } }} />}
                                                        label={<Typography variant="body2" sx={{ fontWeight: 600, color: '#94a3b8' }}>Pro Email</Typography>}
                                                    />
                                                </RadioGroup>
                                                <Button
                                                    fullWidth
                                                    variant="contained"
                                                    size="large"
                                                    onClick={handleSendOTP}
                                                    disabled={isLoading || !identifier}
                                                    sx={{ 
                                                        py: 1.8, 
                                                        borderRadius: '16px', 
                                                        fontWeight: 800, 
                                                        bgcolor: 'rgba(255,255,255,0.03)', 
                                                        color: '#fff',
                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                                                    }}
                                                >
                                                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Dispatch Access Token'}
                                                </Button>
                                            </Box>
                                        ) : (
                                            <TextField
                                                fullWidth
                                                label="6-Digit Protocol Code"
                                                variant="outlined"
                                                sx={{ 
                                                    mb: 4,
                                                    '& .MuiOutlinedInput-root': { color: 'white', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' }, '&:hover fieldset': { borderColor: '#0d9488' } },
                                                    '& .MuiInputLabel-root': { color: '#64748b' },
                                                    '& .MuiInputLabel-root.Mui-focused': { color: '#0d9488' },
                                                }}
                                                required
                                                autoFocus
                                                value={passwordOrOtp}
                                                onChange={(e) => setPasswordOrOtp(e.target.value)}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <TextField
                                        fullWidth
                                        label="Clinical Password"
                                        type="password"
                                        variant="outlined"
                                        sx={{ 
                                            mb: 4,
                                            '& .MuiOutlinedInput-root': { color: 'white', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' }, '&:hover fieldset': { borderColor: '#6366f1' } },
                                            '& .MuiInputLabel-root': { color: '#64748b' },
                                            '& .MuiInputLabel-root.Mui-focused': { color: '#6366f1' },
                                        }}
                                        required
                                        value={passwordOrOtp}
                                        onChange={(e) => setPasswordOrOtp(e.target.value)}
                                        InputProps={{
                                            startAdornment: <LockIcon sx={{ mr: 1.5, color: '#64748b' }} />
                                        }}
                                    />
                                )}

                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    disabled={isLoading || (loginMode === 'otp' && !otpSent)}
                                    sx={{ 
                                        py: 2, 
                                        borderRadius: '16px', 
                                        fontWeight: 900, 
                                        bgcolor: '#0d9488', 
                                        boxShadow: '0 8px 16px rgba(13, 148, 136, 0.3)',
                                        '&:hover': { bgcolor: '#0f766e', transform: 'translateY(-2px)' },
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {isLoading ? 'Authorizing...' : 'Initialize Session'}
                                </Button>

                                <Box sx={{ mt: 5, textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                                        Practitioner without credentials?
                                    </Typography>
                                    <Button
                                        sx={{ fontWeight: 800, mt: 1, color: '#0d9488', py: 1, px: 2, borderRadius: '12px', '&:hover': { bgcolor: 'rgba(13, 148, 136, 0.1)' } }}
                                        onClick={() => navigate('/verify')}
                                    >
                                        Registration Gateway
                                    </Button>
                                </Box>
                            </form>
                        </Paper>
                    </Container>
                </Grid>
            </Grid>
        </Box>
    );
}
