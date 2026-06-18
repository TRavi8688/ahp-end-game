import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ShieldIcon from '@mui/icons-material/Shield';
import BlockIcon from '@mui/icons-material/Block';

export default function SignupScreen() {
    const navigate = useNavigate();

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div className="aurora-1" />
            <div className="aurora-2" />

            <Container maxWidth="sm" sx={{ zIndex: 1 }}>
                <Box className="glass-panel animate-fade-in" sx={{ p: { xs: 4, md: 8 }, textAlign: 'center' }}>
                    <BlockIcon sx={{ fontSize: 80, color: '#f43f5e', mb: 3 }} />
                    <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 2 }}>Registration Restricted</Typography>
                    <Typography variant="body1" sx={{ color: '#cbd5e1', mb: 4, lineHeight: 1.6 }}>
                        Direct practitioner registration has been disabled per the Digital Health Protocol (DHP-8). 
                        To gain access to the Hospyn network, please contact your Hospital Administrator. 
                        They will verify your AHBA ID and Medical Certification through the Gateway Portal and provision your credentials.
                    </Typography>
                    
                    <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, mb: 4 }}>
                        <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                            Already received your credentials via email?
                        </Typography>
                    </Box>

                    <button onClick={() => navigate('/login')} className="btn-premium w-full">
                        Return to Secure Login
                    </button>
                </Box>
            </Container>
        </Box>
    );
}
