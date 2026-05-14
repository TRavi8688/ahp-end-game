import React, { useState } from 'react';
import { 
    Container, Typography, TextField, Button, Box, Paper, 
    Grid, Alert, Tabs, Tab, RadioGroup, FormControlLabel, 
    Radio, CircularProgress, IconButton, InputAdornment 
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import ShieldIcon from '@mui/icons-material/Shield';
import KeyIcon from '@mui/icons-material/Key';
import { API_BASE_URL } from '../api';

export default function LoginScreen() {
    const navigate = useNavigate();

    const [loginMode, setLoginMode] = useState('otp');
    const [identifier, setIdentifier] = useState('');
    const [passwordOrOtp, setPasswordOrOtp] = useState('');
    const [otpChannel, setOtpChannel] = useState('sms');
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
            if (!response.ok) throw new Error(data.detail || 'Failed to dispatch access token');
            setOtpSent(true);
            setSuccessMsg(`Encrypted token dispatched via ${otpChannel === 'sms' ? 'Secure SMS' : 'Pro Email'}.`);
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

            if (!response.ok) throw new Error(data.detail || 'Authentication failed.');

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
        <Box sx={{ minHeight: '100vh', bgcolor: '#020617', display: 'flex', position: 'relative', overflow: 'hidden' }}>
            <div className="aurora-1" />
            <div className="aurora-2" />

            <Grid container sx={{ flex: 1, zIndex: 1 }}>
                {/* Visual Side */}
                <Grid item xs={12} md={6} sx={{ 
                    display: { xs: 'none', md: 'flex' }, 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
                    p: 10,
                    position: 'relative'
                }}>
                    <Box sx={{ mb: 6 }} className="animate-fade-in">
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                            <div style={{ 
                                width: 64, height: 64, background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', 
                                borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)', marginRight: 24
                            }}>
                                <ShieldIcon sx={{ color: 'white', fontSize: 32 }} />
                            </div>
                            <Typography variant="h2" sx={{ fontWeight: 900, color: 'white', letterSpacing: '-0.04em' }}>
                                Hospyn<span style={{ color: '#6366f1' }}>.</span>
                            </Typography>
                        </Box>
                        
                        <Typography variant="h1" sx={{ 
                            fontWeight: 800, color: 'white', fontSize: '3.5rem', lineHeight: 1.1, mb: 4,
                            fontFamily: 'Syne, sans-serif'
                        }}>
                            Clinical <br />
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Intelligence.</span>
                        </Typography>
                        
                        <Typography variant="h6" sx={{ color: '#94a3b8', fontWeight: 400, maxWidth: 500, lineHeight: 1.6, mb: 6 }}>
                            Welcome back to the clinical command center. Access restricted to authorized medical practitioners within the Hospyn network.
                        </Typography>

                        <div className="glass-panel" style={{ padding: 24, maxWidth: 450, background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 900, letterSpacing: 1 }}>SHIELD V10</Typography>
                                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>End-to-end encrypted medical sessions.</Typography>
                                </div>
                                <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.05)' }} />
                                <div style={{ flex: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#0ea5e9', fontWeight: 900, letterSpacing: 1 }}>REAL-TIME</Typography>
                                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>Sub-second clinical data sync.</Typography>
                                </div>
                            </div>
                        </div>
                    </Box>
                </Grid>

                {/* Form Side */}
                <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                    <Box className="glass-panel animate-fade-in" sx={{ width: '100%', maxWidth: 450, p: { xs: 4, md: 8 } }}>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Login</Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', mb: 6 }}>Initialize your secure practitioner session.</Typography>

                        <Tabs 
                            value={loginMode} 
                            onChange={(e, v) => { setLoginMode(v); setOtpSent(false); }}
                            sx={{ 
                                mb: 4, minHeight: 48, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', p: 0.5,
                                '& .MuiTabs-indicator': { display: 'none' },
                                '& .MuiTab-root': { 
                                    textTransform: 'none', fontWeight: 800, color: '#64748b', borderRadius: 2,
                                    '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }
                                }
                            }}
                            variant="fullWidth"
                        >
                            <Tab label="Access Token" value="otp" />
                            <Tab label="Global Password" value="password" />
                        </Tabs>

                        <form onSubmit={handleLogin}>
                            {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3, bgcolor: 'rgba(244,63,94,0.1)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.2)' }}>{errorMsg}</Alert>}
                            {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3, bgcolor: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>{successMsg}</Alert>}

                            <TextField
                                fullWidth
                                placeholder="Practitioner ID or Email"
                                variant="outlined"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                sx={{ 
                                    mb: 3,
                                    '& .MuiOutlinedInput-root': { 
                                        color: 'white', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.02)',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                        '&:hover fieldset': { borderColor: '#6366f1' },
                                        '&.Mui-focused fieldset': { borderColor: '#6366f1' }
                                    }
                                }}
                                InputProps={{
                                    startAdornment: <SmartphoneIcon sx={{ mr: 2, color: '#475569' }} />
                                }}
                            />

                            {loginMode === 'otp' ? (
                                <>
                                    {!otpSent ? (
                                        <Box>
                                            <RadioGroup row value={otpChannel} onChange={(e) => setOtpChannel(e.target.value)} sx={{ mb: 3, justifyContent: 'center' }}>
                                                <FormControlLabel value="sms" control={<Radio sx={{ color: '#334155', '&.Mui-checked': { color: '#6366f1' } }} />} label={<Typography sx={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>SMS</Typography>} />
                                                <FormControlLabel value="email" control={<Radio sx={{ color: '#334155', '&.Mui-checked': { color: '#6366f1' } }} />} label={<Typography sx={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Email</Typography>} />
                                            </RadioGroup>
                                            <button type="button" onClick={handleSendOTP} disabled={isLoading || !identifier} className="btn-premium w-full">
                                                {isLoading ? 'Processing...' : 'Dispatch Token'}
                                            </button>
                                        </Box>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            placeholder="6-Digit Verification Code"
                                            value={passwordOrOtp}
                                            onChange={(e) => setPasswordOrOtp(e.target.value)}
                                            autoFocus
                                            sx={{ 
                                                mb: 4,
                                                '& .MuiOutlinedInput-root': { 
                                                    color: 'white', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.02)',
                                                    '& fieldset': { borderColor: '#6366f1' }
                                                }
                                            }}
                                            InputProps={{ startAdornment: <KeyIcon sx={{ mr: 2, color: '#6366f1' }} /> }}
                                        />
                                    )}
                                </>
                            ) : (
                                <TextField
                                    fullWidth
                                    type="password"
                                    placeholder="Secure Password"
                                    value={passwordOrOtp}
                                    onChange={(e) => setPasswordOrOtp(e.target.value)}
                                    sx={{ 
                                        mb: 4,
                                        '& .MuiOutlinedInput-root': { 
                                            color: 'white', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.02)',
                                            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                            '&:hover fieldset': { borderColor: '#6366f1' }
                                        }
                                    }}
                                    InputProps={{ startAdornment: <LockIcon sx={{ mr: 2, color: '#475569' }} /> }}
                                />
                            )}

                            {(loginMode === 'password' || otpSent) && (
                                <button type="submit" disabled={isLoading} className="btn-premium w-full">
                                    {isLoading ? 'Authorizing...' : 'Initialize Session'}
                                </button>
                            )}

                            <Box sx={{ mt: 6, textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>Unauthorized access attempts are monitored and logged.</Typography>
                                <Button 
                                    onClick={() => navigate('/verify')}
                                    sx={{ color: '#6366f1', fontWeight: 900, letterSpacing: 1, '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.05)' } }}
                                >
                                    REGISTRATION GATEWAY
                                </Button>
                            </Box>
                        </form>
                    </Box>
                </Grid>
            </Grid>

            <style>{`
                .w-full { width: 100%; }
                .MuiTextField-root input::placeholder { color: #475569; opacity: 1; }
            `}</style>
        </Box>
    );
}
