import React, { useState } from 'react';
import {
    Typography, TextField, Button, Box, Grid, Alert, Tabs, Tab,
    RadioGroup, FormControlLabel, Radio, IconButton, InputAdornment
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import ShieldIcon from '@mui/icons-material/Shield';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { authService } from '../services/authService';
import { API_BASE_URL } from '../api'; // FIX: was missing, caused ReferenceError on session/start

function ForgotPasswordScreen({ onBack }) {
    const [step, setStep] = useState('request');
    const [identifier, setIdentifier] = useState('');
    const [otp, setOtp] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPw, setShowNewPw] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const inputSx = {
        mb: 3,
        '& .MuiOutlinedInput-root': {
            color: 'white', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.03)',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
            '&:hover fieldset': { borderColor: '#6366f1' },
            '&.Mui-focused fieldset': { borderColor: '#6366f1' }
        },
        '& .MuiInputLabel-root': { color: '#64748b' }
    };

    const handleRequest = async () => {
        setIsLoading(true); setErrorMsg(''); setSuccessMsg('');
        try {
            await authService.requestPasswordReset(identifier);
            setSuccessMsg('A 6-digit reset code has been sent to your registered email / phone.');
            setStep('verify');
        } catch (err) { setErrorMsg(err.message || 'Failed to send reset code.'); }
        finally { setIsLoading(false); }
    };

    const handleVerify = async () => {
        setIsLoading(true); setErrorMsg('');
        try {
            const result = await authService.verifyPasswordResetOTP(identifier, otp);
            // Backend wraps payloads as { success, message, data: {...} } via
            // success_response() — the reset_token lives at result.data.reset_token,
            // not result.reset_token directly.
            const token = result?.data?.reset_token || result?.reset_token;
            setResetToken(token);
            setStep('reset');
        } catch (err) { setErrorMsg(err.message || 'Invalid or expired code.'); }
        finally { setIsLoading(false); }
    };

    const handleReset = async () => {
        if (newPassword !== confirmPassword) { setErrorMsg('Passwords do not match.'); return; }
        if (newPassword.length < 8) { setErrorMsg('Password must be at least 8 characters.'); return; }
        setIsLoading(true); setErrorMsg('');
        try {
            await authService.resetPassword(resetToken, newPassword);
            setStep('done');
        } catch (err) { setErrorMsg(err.message || 'Reset failed. Please try again.'); }
        finally { setIsLoading(false); }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: 450 }}>
            <Box sx={{ mb: 4 }}>
                <IconButton onClick={onBack} sx={{ color: '#64748b', mb: 2, ml: -1 }}>
                    <ArrowBackIcon />
                    <Typography sx={{ ml: 1, fontSize: '0.9rem' }}>Back to Login</Typography>
                </IconButton>
                <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>
                    {step === 'done' ? 'Password Reset ✓' : 'Recover Access'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                    {step === 'request' && 'Enter your Hospain ID or registered email to receive a reset code.'}
                    {step === 'verify' && 'Enter the 6-digit code sent to your registered contact.'}
                    {step === 'reset' && 'Set a new secure password for your practitioner account.'}
                    {step === 'done' && 'Your password has been reset successfully. You can now log in.'}
                </Typography>
            </Box>

            {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3, bgcolor: 'rgba(244,63,94,0.1)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.2)' }}>{errorMsg}</Alert>}
            {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3, bgcolor: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>{successMsg}</Alert>}

            {step === 'request' && (
                <>
                    <TextField fullWidth label="Hospain ID or Email" value={identifier} onChange={e => setIdentifier(e.target.value)} sx={inputSx} InputProps={{ startAdornment: <EmailIcon sx={{ mr: 2, color: '#475569' }} /> }} />
                    <Button fullWidth variant="contained" onClick={handleRequest} disabled={isLoading || !identifier} sx={{ bgcolor: '#6366f1', borderRadius: '14px', py: 1.8, fontWeight: 900, '&:hover': { bgcolor: '#4f46e5' } }}>
                        {isLoading ? 'Sending...' : 'Send Reset Code'}
                    </Button>
                </>
            )}
            {step === 'verify' && (
                <>
                    <TextField fullWidth label="6-Digit Reset Code" value={otp} onChange={e => setOtp(e.target.value)} sx={inputSx} InputProps={{ startAdornment: <KeyIcon sx={{ mr: 2, color: '#6366f1' }} /> }} />
                    <Button fullWidth variant="contained" onClick={handleVerify} disabled={isLoading || otp.length < 6} sx={{ bgcolor: '#6366f1', borderRadius: '14px', py: 1.8, fontWeight: 900, mb: 2, '&:hover': { bgcolor: '#4f46e5' } }}>
                        {isLoading ? 'Verifying...' : 'Verify Code'}
                    </Button>
                    <Button onClick={handleRequest} sx={{ color: '#64748b', width: '100%', textTransform: 'none' }}>Resend code</Button>
                </>
            )}
            {step === 'reset' && (
                <>
                    <TextField fullWidth label="New Password" type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} sx={inputSx}
                        InputProps={{ startAdornment: <LockIcon sx={{ mr: 2, color: '#475569' }} />, endAdornment: (<IconButton onClick={() => setShowNewPw(v => !v)} edge="end" sx={{ color: '#475569' }}>{showNewPw ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton>) }} />
                    <TextField fullWidth label="Confirm New Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} sx={{ ...inputSx, mb: 4 }} InputProps={{ startAdornment: <LockIcon sx={{ mr: 2, color: '#475569' }} /> }} />
                    <Button fullWidth variant="contained" onClick={handleReset} disabled={isLoading || !newPassword || !confirmPassword} sx={{ bgcolor: '#6366f1', borderRadius: '14px', py: 1.8, fontWeight: 900, '&:hover': { bgcolor: '#4f46e5' } }}>
                        {isLoading ? 'Updating...' : 'Set New Password'}
                    </Button>
                </>
            )}
            {step === 'done' && (
                <Button fullWidth variant="contained" onClick={onBack} sx={{ bgcolor: '#6366f1', borderRadius: '14px', py: 1.8, fontWeight: 900 }}>Return to Login</Button>
            )}
        </Box>
    );
}

export default function LoginScreen() {
    const navigate = useNavigate();
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [loginMode, setLoginMode] = useState('otp');
    const [identifier, setIdentifier] = useState('');
    const [passwordOrOtp, setPasswordOrOtp] = useState('');
    const [otpChannel, setOtpChannel] = useState('sms');
    const [otpSent, setOtpSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const inputSx = {
        '& .MuiOutlinedInput-root': {
            color: 'white', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.02)',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
            '&:hover fieldset': { borderColor: '#6366f1' },
            '&.Mui-focused fieldset': { borderColor: '#6366f1' }
        }
    };

    const handleSendOTP = async () => {
        setIsLoading(true); setErrorMsg(''); setSuccessMsg('');
        try {
            const method = identifier.includes('@') ? 'email' : 'sms';
            await authService.sendOTP(identifier, method);
            setOtpSent(true);
            setSuccessMsg(`Encrypted token dispatched via ${otpChannel === 'sms' ? 'Secure SMS' : 'Pro Email'}.`);
        } catch (error) {
            setErrorMsg(error.message || 'Failed to send OTP.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true); setErrorMsg('');
        try {
            // BUG FIX: OTP mode used to call authService.login() here too,
            // which posts to /auth/login and checks passwordOrOtp against the
            // stored password hash — so a correct 6-digit code always failed
            // with 401. /auth/verify-otp is the endpoint that actually checks
            // it against the code sendOTP issued.
            const data = loginMode === 'otp'
                ? await authService.verifyOTP(identifier, passwordOrOtp)
                : await authService.login(identifier, passwordOrOtp);

            // Verify doctor role from JWT
            try {
                const tokenParts = data.access_token.split('.');
                if (tokenParts.length === 3) {
                    const payload = JSON.parse(atob(tokenParts[1]));
                    if (payload.role !== 'doctor') {
                        throw new Error('Access Denied: This portal is strictly for authorized medical professionals.');
                    }
                }
            } catch (e) {
                throw new Error(e.message || 'Invalid session credentials.');
            }

            sessionStorage.setItem('hospain_access_token', data.access_token);

            // Start doctor session — FIXED: was POST /doctor/session/start,
            // which doesn't exist on the backend at all. The real endpoint
            // (workflow.py's queue_router) is /queue/session/start, mounted
            // under the /healthcare prefix like everything else in
            // healthcare-core.
            try {
                await fetch(`${API_BASE_URL}/healthcare/queue/session/start`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${data.access_token}` }
                });
            } catch (e) {
                console.error('Failed to start session', e);
                // Non-fatal — proceed anyway
            }

            window.location.href = '/';
        } catch (error) {
            setErrorMsg(error.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#020617', display: 'flex', position: 'relative', overflow: 'hidden' }}>
            <Grid container sx={{ flex: 1, zIndex: 1 }}>
                {/* Visual Side */}
                <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'center', p: 10 }}>
                    <Box sx={{ mb: 6 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                            {/* Logo */}
                            <Box sx={{ background: 'white', borderRadius: '16px', px: 2, py: 1.5, display: 'inline-flex' }}>
                                <img src="/assets/hospain-logo.png" alt="Hospain — Care Beyond Today" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
                            </Box>
                        </Box>
                        <Typography variant="h1" sx={{ fontWeight: 800, color: 'white', fontSize: '3.5rem', lineHeight: 1.1, mb: 4, fontFamily: 'Syne, sans-serif' }}>
                            Clinical <br /><span style={{ color: 'rgba(255,255,255,0.4)' }}>Intelligence.</span>
                        </Typography>
                        <Typography variant="h6" sx={{ color: '#94a3b8', fontWeight: 400, maxWidth: 500, lineHeight: 1.6, mb: 6 }}>
                            Welcome back to the clinical command center. Access restricted to authorized medical practitioners within the Hospain network.
                        </Typography>
                        <Box sx={{ p: 3, maxWidth: 450, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 900, letterSpacing: 1 }}>SHIELD V10</Typography>
                                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>End-to-end encrypted medical sessions.</Typography>
                                </Box>
                                <Box sx={{ width: 1, bgcolor: 'rgba(255,255,255,0.05)' }} />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#0ea5e9', fontWeight: 900, letterSpacing: 1 }}>REAL-TIME</Typography>
                                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>Sub-second clinical data sync.</Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Grid>

                {/* Form Side */}
                <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                    <Box sx={{ width: '100%', maxWidth: 450, p: { xs: 4, md: 8 }, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '32px', backdropFilter: 'blur(24px)' }}>
                        {showForgotPassword ? (
                            <ForgotPasswordScreen onBack={() => setShowForgotPassword(false)} />
                        ) : (
                            <>
                                <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Login</Typography>
                                <Typography variant="body2" sx={{ color: '#64748b', mb: 6 }}>Initialize your secure practitioner session.</Typography>

                                <Tabs value={loginMode} onChange={(e, v) => { setLoginMode(v); setOtpSent(false); setPasswordOrOtp(''); }}
                                    sx={{ mb: 4, minHeight: 48, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', p: 0.5, '& .MuiTabs-indicator': { display: 'none' }, '& .MuiTab-root': { textTransform: 'none', fontWeight: 800, color: '#64748b', borderRadius: 2, '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.05)', color: 'white' } } }}
                                    variant="fullWidth">
                                    <Tab label="Access Token" value="otp" />
                                    <Tab label="Password" value="password" />
                                </Tabs>

                                <form onSubmit={handleLogin}>
                                    {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3, bgcolor: 'rgba(244,63,94,0.1)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.2)' }}>{errorMsg}</Alert>}
                                    {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3, bgcolor: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>{successMsg}</Alert>}

                                    <TextField fullWidth placeholder="Hospain ID, Email or Phone" value={identifier} onChange={(e) => setIdentifier(e.target.value)} sx={{ mb: 3, ...inputSx }} InputProps={{ startAdornment: <SmartphoneIcon sx={{ mr: 2, color: '#475569' }} /> }} />

                                    {loginMode === 'otp' ? (
                                        !otpSent ? (
                                            <Box>
                                                <RadioGroup row value={otpChannel} onChange={(e) => setOtpChannel(e.target.value)} sx={{ mb: 3, justifyContent: 'center' }}>
                                                    <FormControlLabel value="sms" control={<Radio sx={{ color: '#334155', '&.Mui-checked': { color: '#6366f1' } }} />} label={<Typography sx={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>SMS</Typography>} />
                                                    <FormControlLabel value="email" control={<Radio sx={{ color: '#334155', '&.Mui-checked': { color: '#6366f1' } }} />} label={<Typography sx={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Email</Typography>} />
                                                </RadioGroup>
                                                <Button type="button" fullWidth variant="contained" onClick={handleSendOTP} disabled={isLoading || !identifier} sx={{ bgcolor: '#6366f1', borderRadius: '14px', py: 1.8, fontWeight: 900, '&:hover': { bgcolor: '#4f46e5' } }}>
                                                    {isLoading ? 'Processing...' : 'Dispatch Token'}
                                                </Button>
                                            </Box>
                                        ) : (
                                            <TextField fullWidth placeholder="6-Digit Verification Code" value={passwordOrOtp} onChange={(e) => setPasswordOrOtp(e.target.value)} autoFocus sx={{ mb: 4, ...inputSx }} InputProps={{ startAdornment: <KeyIcon sx={{ mr: 2, color: '#6366f1' }} /> }} />
                                        )
                                    ) : (
                                        <>
                                            <TextField fullWidth type={showPassword ? 'text' : 'password'} placeholder="Secure Passkey" value={passwordOrOtp} onChange={(e) => setPasswordOrOtp(e.target.value)} sx={{ mb: 1, ...inputSx }}
                                                InputProps={{ startAdornment: <LockIcon sx={{ mr: 2, color: '#475569' }} />, endAdornment: (<IconButton onClick={() => setShowPassword(v => !v)} edge="end" sx={{ color: '#475569' }}>{showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton>) }} />
                                            <Box sx={{ textAlign: 'right', mb: 3 }}>
                                                <Button onClick={() => setShowForgotPassword(true)} sx={{ color: '#6366f1', fontWeight: 700, textTransform: 'none', fontSize: '0.8rem', p: 0, minWidth: 0 }}>Forgot password?</Button>
                                            </Box>
                                        </>
                                    )}

                                    {(loginMode === 'password' || otpSent) && (
                                        <Button type="submit" fullWidth variant="contained" disabled={isLoading} sx={{ bgcolor: '#6366f1', borderRadius: '14px', py: 1.8, fontWeight: 900, boxShadow: '0 8px 25px rgba(99,102,241,0.35)', '&:hover': { bgcolor: '#4f46e5' } }}>
                                            {isLoading ? 'Authorizing...' : 'Initialize Session'}
                                        </Button>
                                    )}

                                    <Box sx={{ mt: 6, textAlign: 'center' }}>
                                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>Unauthorized access attempts are monitored and logged.</Typography>
                                        <Button onClick={() => navigate('/verify')} sx={{ color: '#6366f1', fontWeight: 900, letterSpacing: 1 }}>REGISTRATION GATEWAY</Button>
                                    </Box>
                                </form>
                            </>
                        )}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
