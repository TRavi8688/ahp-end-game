import React, { useState } from 'react';
import { 
    Container, Typography, TextField, Button, Box, Paper, 
    Grid, Alert, Stepper, Step, StepLabel, LinearProgress, 
    Divider, MenuItem, IconButton, InputAdornment 
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonPinIcon from '@mui/icons-material/PersonPin';
import BadgeIcon from '@mui/icons-material/Badge';
import SecurityIcon from '@mui/icons-material/Security';
import ShieldIcon from '@mui/icons-material/Shield';
import { API_BASE_URL } from '../api';

const STEPS = ['Clinical Identity', 'Forensic Check', 'Factor Auth', 'Secure Vault'];

const STATE_COUNCILS = [
    "National Medical Commission (NMC)",
    "Andhra Pradesh Medical Council",
    "Delhi Medical Council",
    "Karnataka Medical Council",
    "Maharashtra Medical Council",
    "Tamil Nadu Medical Council",
    "Uttar Pradesh Medical Council",
    "West Bengal Medical Council"
];

export default function SignupScreen() {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [finalUser, setFinalUser] = useState(null);

    const [formData, setFormData] = useState({
        full_name: '',
        registration_number: '',
        state_medical_council: 'National Medical Commission (NMC)',
        mobile_number: '',
        otp: '',
        password: '',
        confirm_password: ''
    });

    const [files, setFiles] = useState({ aadhaar: null, selfie: null });
    const [previews, setPreviews] = useState({ aadhaar: null, selfie: null });

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            setFiles({ ...files, [type]: file });
            const reader = new FileReader();
            reader.onloadend = () => setPreviews({ ...previews, [type]: reader.result });
            reader.readAsDataURL(file);
        }
    };

    const handleStartVerify = async () => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const response = await fetch(`${API_BASE_URL}/doctor/verify/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Clinical registry validation failed');
            setSessionId(data.session_id);
            setActiveStep(1);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadIdentity = async () => {
        if (!files.aadhaar || !files.selfie) {
            setErrorMsg("Forensic matching requires both Identity Document and Live Capture.");
            return;
        }
        setIsLoading(true);
        setErrorMsg('');
        const data = new FormData();
        data.append('aadhaar_file', files.aadhaar);
        data.append('selfie_file', files.selfie);

        try {
            const response = await fetch(`${API_BASE_URL}/doctor/verify/identity?session_id=${sessionId}`, {
                method: 'POST',
                body: data
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || 'Identity matching failed');
            await fetch(`${API_BASE_URL}/doctor/verify/send-otp?session_id=${sessionId}`, { method: 'POST' });
            setActiveStep(2);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const response = await fetch(`${API_BASE_URL}/doctor/verify/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, otp: formData.otp })
            });
            if (!response.ok) throw new Error('Security token mismatch');
            setActiveStep(3);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleComplete = async () => {
        if (formData.password !== formData.confirm_password) {
            setErrorMsg("Secure keys do not match");
            return;
        }
        setIsLoading(true);
        setErrorMsg('');
        try {
            const response = await fetch(`${API_BASE_URL}/doctor/verify/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, password: formData.password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Workspace initialization failed');
            
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('isVerified', 'true');

            const payload = JSON.parse(window.atob(data.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            setFinalUser(payload.sub);
            setActiveStep(4);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#020617', display: 'flex', position: 'relative', overflow: 'hidden' }}>
            <div className="aurora-1" />
            <div className="aurora-2" />

            <Box sx={{
                width: { xs: '0', md: '380px' },
                bgcolor: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(40px)',
                display: { xs: 'none', md: 'flex' },
                flexDirection: 'column',
                p: 6,
                borderRight: '1px solid rgba(255,255,255,0.05)',
                zIndex: 2
            }}>
                <Box sx={{ mb: 10, display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, background: '#6366f1', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                        <ShieldIcon sx={{ color: 'white', fontSize: 24 }} />
                    </div>
                    <Typography variant="h4" sx={{ fontWeight: 900, color: 'white', letterSpacing: '-0.04em' }}>Hospyn</Typography>
                </Box>

                <Stepper activeStep={activeStep} orientation="vertical" sx={{ 
                    '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1 },
                    '& .MuiStepLabel-label.Mui-active': { color: 'white' },
                    '& .MuiStepLabel-label.Mui-completed': { color: '#6366f1' },
                    '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.05)' },
                    '& .MuiStepIcon-root.Mui-active': { color: '#6366f1' },
                    '& .MuiStepIcon-root.Mui-completed': { color: '#10b981' },
                }}>
                    {STEPS.map((label) => (
                        <Step key={label}><StepLabel>{label}</StepLabel></Step>
                    ))}
                </Stepper>

                <Box sx={{ mt: 'auto', p: 4, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.6, display: 'block' }}>
                        Clinical onboarding is governed by the Digital Health Protocol (DHP-8). All data is encrypted using military-grade RSA-4096 standards.
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4, zIndex: 1 }}>
                <Container maxWidth="sm">
                    <Box className="glass-panel animate-fade-in" sx={{ p: { xs: 4, md: 8 } }}>
                        {activeStep === 0 && (
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Clinical Onboarding</Typography>
                                <Typography variant="body2" sx={{ color: '#64748b', mb: 5 }}>Validate your credentials with the National Registry.</Typography>
                                {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{errorMsg}</Alert>}
                                <Grid container spacing={3}>
                                    <Grid item xs={12}><TextField fullWidth placeholder="Legal Full Name" name="full_name" value={formData.full_name} onChange={handleChange} className="luxury-input" /></Grid>
                                    <Grid item xs={12}><TextField fullWidth placeholder="Medical Registration Number" name="registration_number" value={formData.registration_number} onChange={handleChange} className="luxury-input" /></Grid>
                                    <Grid item xs={12}>
                                        <TextField select fullWidth name="state_medical_council" value={formData.state_medical_council} onChange={handleChange} className="luxury-input">
                                            {STATE_COUNCILS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                        </TextField>
                                    </Grid>
                                    <Grid item xs={12}><TextField fullWidth placeholder="Registered Mobile Number" name="mobile_number" value={formData.mobile_number} onChange={handleChange} className="luxury-input" /></Grid>
                                    <Grid item xs={12}><button onClick={handleStartVerify} disabled={isLoading} className="btn-premium w-full">{isLoading ? 'Verifying...' : 'Continue to Identity'}</button></Grid>
                                </Grid>
                            </Box>
                        )}

                        {activeStep === 1 && (
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Forensic Check</Typography>
                                <Typography variant="body2" sx={{ color: '#64748b', mb: 5 }}>AI biometric matching for secure clinical access.</Typography>
                                <Grid container spacing={3}>
                                    <Grid item xs={12}>
                                        <Box sx={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 4, p: 4, textAlign: 'center' }}>
                                            {previews.aadhaar ? <img src={previews.aadhaar} style={{ width: '100%', borderRadius: 8 }} /> : <Typography variant="caption" color="#475569">UPLOAD ID DOCUMENT</Typography>}
                                            <input type="file" hidden id="aadhaar" onChange={(e) => handleFileChange(e, 'aadhaar')} />
                                            <Button component="label" htmlFor="aadhaar" sx={{ mt: 2, color: '#6366f1' }}>Select File</Button>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Box sx={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 4, p: 4, textAlign: 'center' }}>
                                            {previews.selfie ? <img src={previews.selfie} style={{ width: '100%', borderRadius: 8 }} /> : <Typography variant="caption" color="#475569">CAPTURE LIVE SELFIE</Typography>}
                                            <input type="file" hidden id="selfie" onChange={(e) => handleFileChange(e, 'selfie')} />
                                            <Button component="label" htmlFor="selfie" sx={{ mt: 2, color: '#6366f1' }}>Capture</Button>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12}><button onClick={handleUploadIdentity} disabled={isLoading} className="btn-premium w-full">{isLoading ? 'Analyzing...' : 'Run Forensic Match'}</button></Grid>
                                </Grid>
                            </Box>
                        )}

                        {activeStep === 2 && (
                            <Box sx={{ textAlign: 'center' }}>
                                <SecurityIcon sx={{ fontSize: 64, color: '#6366f1', mb: 3 }} />
                                <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Security Protocol</Typography>
                                <Typography variant="body2" sx={{ color: '#64748b', mb: 6 }}>Enter the secure token sent to {formData.mobile_number}</Typography>
                                <TextField fullWidth placeholder="000 000" name="otp" value={formData.otp} onChange={handleChange} sx={{ mb: 4 }} InputProps={{ style: { fontSize: '2.5rem', color: 'white', textAlign: 'center', fontWeight: 900, letterSpacing: '0.8rem' } }} />
                                <button onClick={handleVerifyOTP} disabled={isLoading} className="btn-premium w-full">Verify Factor</button>
                            </Box>
                        )}

                        {activeStep === 3 && (
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Secure Vault</Typography>
                                <Typography variant="body2" sx={{ color: '#64748b', mb: 5 }}>Finalize your clinical access keys.</Typography>
                                <Grid container spacing={3}>
                                    <Grid item xs={12}><TextField fullWidth type="password" placeholder="Master Key" name="password" onChange={handleChange} className="luxury-input" /></Grid>
                                    <Grid item xs={12}><TextField fullWidth type="password" placeholder="Confirm Key" name="confirm_password" onChange={handleChange} className="luxury-input" /></Grid>
                                    <Grid item xs={12}><button onClick={handleComplete} className="btn-premium w-full">Activate Workspace</button></Grid>
                                </Grid>
                            </Box>
                        )}

                        {activeStep === 4 && (
                            <Box sx={{ textAlign: 'center' }}>
                                <CheckCircleIcon sx={{ fontSize: 80, color: '#10b981', mb: 4 }} />
                                <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Workspace Active</Typography>
                                <Typography variant="body1" sx={{ color: '#94a3b8', mb: 6 }}>Welcome to the network, Dr. {formData.full_name.split(' ').pop()}. Your unique clinical ID is:</Typography>
                                <Box sx={{ p: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, mb: 6 }}>
                                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#6366f1', letterSpacing: 2 }}>{finalUser}</Typography>
                                </Box>
                                <button onClick={() => navigate('/')} className="btn-premium w-full">Enter Command Center</button>
                            </Box>
                        )}
                    </Box>
                </Container>
            </Box>

            <style>{`
                .luxury-input .MuiOutlinedInput-root { color: white; border-radius: 16px; background: rgba(255,255,255,0.02); }
                .luxury-input .MuiOutlinedInput-notchedOutline { border-color: rgba(255,255,255,0.1); }
                .luxury-input:hover .MuiOutlinedInput-notchedOutline { border-color: #6366f1; }
                .w-full { width: 100%; }
            `}</style>
        </Box>
    );
}
