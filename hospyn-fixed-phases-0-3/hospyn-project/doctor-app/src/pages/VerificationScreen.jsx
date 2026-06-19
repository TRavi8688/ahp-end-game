import React, { useState } from 'react';
import { Container, Typography, TextField, Button, Box, Paper, Grid, Alert, MenuItem, Fade, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

const STATE_COUNCILS = [
    "Medical Council of India (MCI) / NMC",
    "Andhra Pradesh Medical Council",
    "Arunachal Pradesh Medical Council",
    "Assam Medical Council",
    "Bihar Medical Council",
    "Chhattisgarh Medical Council",
    "Delhi Medical Council",
    "Goa Medical Council",
    "Gujarat Medical Council",
    "Haryana Medical Council",
    "Himachal Pradesh Medical Council",
    "Jharkhand Medical Council",
    "Karnataka Medical Council",
    "Kerala Medical Council",
    "Madhya Pradesh Medical Council",
    "Maharashtra Medical Council",
    "Odisha Council of Medical Registration",
    "Punjab Medical Council",
    "Rajasthan Medical Council",
    "Tamil Nadu Medical Council",
    "Telangana State Medical Council",
    "Uttar Pradesh Medical Council",
    "Uttarakhand Medical Council",
    "West Bengal Medical Council"
];

const glassStyle = {
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
};

const inputStyle = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
    '&:hover fieldset': { borderColor: '#14B8A6' },
    '&.Mui-focused fieldset': { borderColor: '#14B8A6' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.5)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#14B8A6' },
  '& .MuiFormHelperText-root': { color: 'rgba(255, 255, 255, 0.3)' }
};

export default function VerificationScreen() {
    const navigate = useNavigate();
    const [status, setStatus] = useState('idle'); // idle | submitting | pending | error
    const [errorMessage, setErrorMessage] = useState('');
    
    // Form State
    const [formData, setFormData] = useState({
        full_name: '',
        registration_number: '',
        state_council: '',
        specialty: '',
        experience_years: '',
        hospital_affiliation: ''
    });

    const handleChange = (e) => {
        setFormData({...formData, [e.target.name]: e.target.value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');
        setErrorMessage('');

        try {
            const response = await fetch(`${API_BASE_URL}/doctor/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    full_name: formData.full_name,
                    registration_number: formData.registration_number,
                    state_council: formData.state_council,
                    specialty: formData.specialty,
                    experience_years: parseInt(formData.experience_years, 10),
                    hospital_affiliation: formData.hospital_affiliation
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Verification failed. Please check your credentials.');
            }

            setStatus('pending');
            
            // Save token and mark as verified
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('isVerified', 'true');
            if (data.access_token) {
                localStorage.setItem('token', data.access_token);
            }

            // Mock immediate verification for our demo
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);

        } catch (error) {
            setStatus('error');
            setErrorMessage(error.message);
        }
    };

    if (status === 'pending') {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#050810' }}>
                <Fade in={true}>
                    <Container maxWidth="sm">
                        <Paper sx={{ ...glassStyle, p: 6, textAlign: 'center', borderRadius: 6 }}>
                             <VerifiedUserIcon sx={{ fontSize: 80, color: '#14B8A6', mb: 3 }} />
                             <Typography variant="h4" sx={{ color: '#fff', fontFamily: 'Outfit', fontWeight: 600, mb: 2 }}>
                               Identity Verified
                             </Typography>
                             <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 4 }}>
                               Your credentials have been validated against the National Health Registry. Encrypting your clinical session...
                             </Typography>
                             <CircularProgress sx={{ color: '#14B8A6' }} />
                        </Paper>
                    </Container>
                </Fade>
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#050810', py: 8, px: 2 }}>
            <Container maxWidth="md">
                <Fade in={true} timeout={1000}>
                    <Paper elevation={0} sx={{ 
                        ...glassStyle, 
                        p: { xs: 4, md: 6 }, 
                        borderRadius: 6,
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Radical Background Accents */}
                        <Box sx={{ 
                            position: 'absolute', top: -100, right: -100, 
                            width: 300, height: 300, 
                            background: 'radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, transparent 70%)',
                            filter: 'blur(60px)',
                            zIndex: 0
                        }} />

                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                            <Box sx={{ mb: 6, textAlign: 'center' }}>
                                <Typography variant="h3" sx={{ 
                                    fontFamily: 'Outfit', 
                                    fontWeight: 700, 
                                    color: '#fff',
                                    mb: 1,
                                    letterSpacing: '-0.02em'
                                }}>
                                    Clinical Credentials
                                </Typography>
                                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.5)', maxWidth: 600, mx: 'auto' }}>
                                    To ensure the integrity of the Hospyn ecosystem, we verify all clinicians against global medical registries. This is a one-time secure protocol.
                                </Typography>
                            </Box>

                            {status === 'error' && (
                                <Alert severity="error" sx={{ mb: 4, borderRadius: 3, bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                                    {errorMessage}
                                </Alert>
                            )}

                            <form onSubmit={handleSubmit}>
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                        <TextField 
                                            fullWidth label="Full Legal Name" 
                                            name="full_name" value={formData.full_name} 
                                            onChange={handleChange} required 
                                            sx={inputStyle}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField 
                                            fullWidth label="Registration Number" 
                                            name="registration_number" value={formData.registration_number} 
                                            onChange={handleChange} required 
                                            placeholder="e.g. NMC-12345" 
                                            helperText="Demo Hint: Start with 'NMC-'"
                                            sx={inputStyle}
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <TextField
                                            select
                                            fullWidth
                                            label="Council of Registration"
                                            name="state_council"
                                            value={formData.state_council}
                                            onChange={handleChange}
                                            required
                                            sx={inputStyle}
                                        >
                                            {STATE_COUNCILS.map((council) => (
                                                <MenuItem key={council} value={council}>
                                                    {council}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <TextField 
                                            fullWidth label="Clinical Specialty" 
                                            name="specialty" value={formData.specialty} 
                                            onChange={handleChange} required 
                                            sx={inputStyle}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField 
                                            fullWidth label="Years of Practice" 
                                            name="experience_years" type="number" 
                                            value={formData.experience_years} 
                                            onChange={handleChange} required 
                                            sx={inputStyle}
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <TextField 
                                            fullWidth label="Primary Hospital Affiliation" 
                                            name="hospital_affiliation" value={formData.hospital_affiliation} 
                                            onChange={handleChange} required 
                                            sx={inputStyle}
                                        />
                                    </Grid>

                                    <Grid item xs={12} mt={2}>
                                        <Typography sx={{ color: '#fff', fontFamily: 'Outfit', fontSize: '1rem', mb: 2 }}>
                                            Medical License Documentation
                                        </Typography>
                                        <Button
                                            component="label"
                                            variant="outlined"
                                            startIcon={<CloudUploadIcon />}
                                            sx={{ 
                                                py: 4, width: '100%', 
                                                borderStyle: 'dashed', 
                                                borderWidth: 2,
                                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.5)',
                                                borderRadius: 4,
                                                '&:hover': {
                                                    borderColor: '#14B8A6',
                                                    background: 'rgba(20, 184, 166, 0.05)'
                                                }
                                            }}
                                        >
                                            Click to Upload License (PDF/JPEG)
                                            <input type="file" hidden accept=".pdf,image/*" />
                                        </Button>
                                    </Grid>

                                    <Grid item xs={12} mt={4}>
                                        <Button
                                            type="submit"
                                            fullWidth
                                            variant="contained"
                                            disabled={status === 'submitting'}
                                            sx={{ 
                                                py: 2, 
                                                fontSize: '1.1rem',
                                                fontFamily: 'Outfit',
                                                fontWeight: 600,
                                                borderRadius: 4,
                                                bgcolor: '#14B8A6',
                                                textTransform: 'none',
                                                '&:hover': { bgcolor: '#0D9488' }
                                            }}
                                        >
                                            {status === 'submitting' ? (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <CircularProgress size={20} color="inherit" />
                                                    Validating Protocol...
                                                </Box>
                                            ) : "Submit Verification Request"}
                                        </Button>
                                    </Grid>
                                </Grid>
                            </form>

                            <Box textAlign="center" mt={4}>
                                <Button 
                                    onClick={() => navigate('/login')}
                                    sx={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'none' }}
                                >
                                    Cancel & Return Home
                                </Button>
                            </Box>
                        </Box>
                    </Paper>
                </Fade>
            </Container>
        </Box>
    );
}
