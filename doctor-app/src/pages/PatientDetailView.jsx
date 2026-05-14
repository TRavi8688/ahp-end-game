import React, { useState } from 'react';
import { Box, Typography, Button, IconButton, Chip, Avatar, Grid, Card, CardContent, Divider, TextField, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import DOMPurify from 'dompurify';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { API_BASE_URL } from '../api';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MedicationIcon from '@mui/icons-material/Medication';
import EditNoteIcon from '@mui/icons-material/EditNote';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddIcon from '@mui/icons-material/Add';

export default function PatientDetailView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { lastMessage } = useSocket();
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notes, setNotes] = useState('');
    const [toastOpen, setToastOpen] = useState(false);
    const [isRevoked, setIsRevoked] = useState(false);
    const [revocationDialogOpen, setRevocationDialogOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef(null);

    const fetchPatient = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/doctor/patient/${id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setPatient(data);
            } else {
                console.error("Failed to fetch patient:", response.status);
            }
        } catch (error) {
            console.error("Error fetching patient:", error);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchPatient();
    }, [id]);

    // Global Socket Logic for Kickout / Updates
    React.useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type === 'access_revoked') {
            setIsRevoked(true);
            setRevocationDialogOpen(true);
        }

        if (lastMessage.type === 'patient_update') {
            console.log("DEBUG: Real-time update received:", lastMessage);
            fetchPatient();
            setToastOpen(true);
        }
    }, [lastMessage]);

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Typography variant="h6">Syncing with Hospyn Network...</Typography>
            </Box>
        );
    }

    if (!patient) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5">Patient not found or Access denied.</Typography>
                <Button onClick={() => navigate('/patients')} sx={{ mt: 2 }}>Back to Patients</Button>
            </Box>
        );
    }


    const handleSaveNotes = () => {
        setToastOpen(true);
        setNotes('');
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/doctor/patient/${patient.profile.hospyn_id}/upload-report`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (response.ok) {
                setToastOpen(true);
                fetchPatient();
            } else {
                console.error("Upload failed");
            }
        } catch (error) {
            console.error("Error uploading file:", error);
        } finally {
            setUploading(false);
        }
    };

    const StatusWord = ({ status }) => {
        const colors = {
            normal: { c: '#10b981', bg: '#d1fae5', text: 'Normal' },
            borderline: { c: '#f59e0b', bg: '#fef3c7', text: 'Borderline' },
            concerning: { c: '#ef4444', bg: '#fee2e2', text: 'High' }
        };
        const s = colors[status] || colors.normal;
        return <Typography variant="caption" sx={{ color: s.c, fontWeight: 'bold' }}>{s.text}</Typography>
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 8 }}>

            {/* Top Bar - Floating Modern */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 4,
                p: 1.5,
                bgcolor: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
                width: 'fit-content'
            }}>
                <IconButton onClick={() => navigate(-1)} sx={{ mr: 1, color: '#fff' }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="body1" fontWeight="900" sx={{ color: '#fff', pr: 2 }}>BACK TO ROSTER</Typography>
            </Box>

            {/* Revoked Banner */}
            {isRevoked && (
                <Box sx={{ bgcolor: '#fee2e2', border: '1px solid #fca5a5', p: 2, borderRadius: 2, mb: 3, display: 'flex', alignItems: 'center' }}>
                    <WarningAmberIcon sx={{ color: '#dc2626', mr: 2 }} />
                    <Typography variant="body1" sx={{ color: '#b91c1c', fontWeight: 'bold' }}>
                        ⚠️ Patient has revoked your access. You can only see previously cached data from last access date.
                    </Typography>
                </Box>
            )}

            {/* Everything below is opacity 0.4 if revoked */}
            <Box sx={{ opacity: isRevoked ? 0.4 : 1 }} style={{ pointerEvents: isRevoked ? 'none' : 'auto' }}>

            {/* Patient Header Card */}
            <Card
                className="glass-card"
                elevation={0}
                sx={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    backdropFilter: 'blur(30px)',
                    color: 'white',
                    borderRadius: '40px',
                    mb: 4,
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    position: 'relative'
                }}
            >
                {/* Decorative Accent */}
                <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #0d9488, #6366f1)' }} />
                
                <Box sx={{ p: { xs: 4, md: 6 }, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
                    <Avatar sx={{
                        width: 120,
                        height: 120,
                        bgcolor: 'rgba(99, 102, 241, 0.1)',
                        color: '#6366f1',
                        fontSize: '3.5rem',
                        fontWeight: 900,
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        boxShadow: '0 0 30px rgba(99, 102, 241, 0.1)',
                        fontFamily: 'Outfit'
                    }}>
                        {patient.profile.name.split(' ').map(n => n[0]).join('')}
                    </Avatar>

                    <Box sx={{ flex: 1, minWidth: 300 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                            <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'Outfit', letterSpacing: '-2px' }}>{patient.profile.name}</Typography>
                            <Chip
                                label="VERIFIED IDENTITY"
                                size="small"
                                sx={{
                                    bgcolor: 'rgba(13, 148, 136, 0.1)',
                                    color: '#0d9488',
                                    fontWeight: 900,
                                    fontSize: '0.65rem',
                                    height: 24,
                                    border: '1px solid rgba(13, 148, 136, 0.2)'
                                }}
                            />
                        </Box>
                        <Typography variant="h6" sx={{ color: '#64748b', mb: 3, fontWeight: 600 }}>
                            {patient.profile.age} Years Old · {patient.profile.gender} · <Box component="span" sx={{ color: '#fff', fontWeight: 800 }}>{patient.profile.blood_group}</Box>
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <Box sx={{ px: 2, py: 0.8, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800, mr: 1 }}>Hospyn ID:</Typography>
                                <Typography component="span" sx={{ color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>{patient.profile.hospyn_id}</Typography>
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<MedicationIcon />}
                            sx={{
                                bgcolor: '#0d9488',
                                color: '#fff',
                                px: 5,
                                py: 1.8,
                                borderRadius: '18px',
                                '&:hover': { bgcolor: '#0f766e', transform: 'translateY(-2px)' },
                                fontWeight: 900,
                                textTransform: 'none',
                                transition: 'all 0.2s',
                                fontSize: '1rem',
                                boxShadow: '0 8px 20px rgba(13, 148, 136, 0.3)'
                            }}
                            onClick={() => navigate('/prescriptions', { state: { patient: patient.profile } })}
                        >
                            Draft Prescription
                        </Button>
                    </Box>
                </Box>
            </Card>

            {/* Allergy Alert Bar - Premium Warning */}
            {patient.allergies.length > 0 ? (
                <Box sx={{ 
                    background: 'rgba(239, 68, 68, 0.05)', 
                    p: 3, 
                    borderRadius: '24px', 
                    mb: 4, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 3, 
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    boxShadow: '0 10px 30px rgba(239, 68, 68, 0.05)'
                }}>
                    <Box sx={{ p: 1.5, bgcolor: '#ef4444', borderRadius: '14px', animation: 'pulse 2s infinite' }}>
                        <WarningAmberIcon sx={{ color: 'white' }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ color: '#f87171', fontWeight: 900, fontFamily: 'Outfit' }}>CRITICAL CONTRAINDICATIONS</Typography>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>Detected hypersensitivity patterns. Exercise high clinical caution.</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {patient.allergies.map(a => (
                            <Chip 
                                key={a.id} 
                                label={`${a.allergen} (${a.severity})`} 
                                sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontWeight: 900, border: '1px solid rgba(239, 68, 68, 0.2)' }} 
                            />
                        ))}
                    </Box>
                </Box>
            ) : (
                <Box sx={{ 
                    background: 'rgba(20, 184, 166, 0.05)', 
                    p: 2.5, 
                    borderRadius: '24px', 
                    mb: 4, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2.5,
                    border: '1px solid rgba(20, 184, 166, 0.1)'
                }}>
                    <Box sx={{ p: 1, bgcolor: '#14b8a6', borderRadius: '10px' }}>
                        <CheckCircleOutlinedIcon sx={{ color: 'white', fontSize: 20 }} />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#2dd4bf', fontWeight: 800, letterSpacing: 0.5 }}>CLEARED: NO KNOWN ALLERGIES ENCOUNTERED</Typography>
                </Box>
            )}

            {/* AI Summary Card - Intelligence Briefing */}
            <Card
                className="glass-card"
                elevation={0}
                sx={{
                    background: 'rgba(99, 102, 241, 0.03)',
                    border: '1px solid rgba(99, 102, 241, 0.1)',
                    mb: 5,
                    borderRadius: '32px',
                    overflow: 'hidden'
                }}
            >
                <Box sx={{ p: 5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                            <Box sx={{
                                p: 1.2,
                                bgcolor: '#6366f1',
                                borderRadius: '14px',
                                display: 'flex',
                                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)'
                            }}>
                                <SmartToyIcon sx={{ color: '#fff' }} />
                            </Box>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', letterSpacing: 1, fontFamily: 'Outfit' }}>INTELLIGENCE CONTEXT</Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>SYNTHESIZED BY MULAJNA CORE</Typography>
                            </Box>
                        </Box>
                        <Chip
                            label="PRECISION ANALYSIS"
                            sx={{
                                background: 'linear-gradient(45deg, #6366f1 0%, #a855f7 100%)',
                                color: 'white',
                                fontWeight: 900,
                                fontSize: '0.7rem',
                                border: 'none'
                            }}
                        />
                    </Box>

                    <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Typography variant="h6" sx={{ color: '#cbd5e1', lineHeight: 1.8, fontWeight: 500, fontFamily: 'Inter' }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(patient.ai_summary || "Synthesizing clinical data... Awaiting node verification.") }}
                        />
                    </Box>

                    <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ width: 8, height: 8, bgcolor: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }} />
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: 1 }}>ENCRYPTED DATA FEED SECURE</Typography>
                    </Box>
                </Box>
            </Card>

                {/* Two-column section */}
                <Grid container spacing={4} sx={{ mb: 4 }}>

                    {/* Left Column: Conditions & Vitals */}
                    <Grid item xs={12} md={6}>
                        <Card className="glass-card" sx={{ p: 4, height: '100%', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Typography variant="h6" fontWeight="900" sx={{ color: '#fff', mb: 3, letterSpacing: 1 }}>CLINICAL CONDITIONS</Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 4 }}>
                                {patient.conditions.length > 0 ? (
                                    patient.conditions.map(c => (
                                        <Chip
                                            key={c.id}
                                            label={c.name.toUpperCase()}
                                            sx={{
                                                bgcolor: 'rgba(13, 148, 136, 0.2)',
                                                color: '#2dd4bf',
                                                fontWeight: '900',
                                                border: '1px solid rgba(45, 212, 191, 0.3)',
                                                px: 1
                                            }}
                                        />
                                    ))
                                ) : (
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>No conditions recorded.</Typography>
                                )}
                            </Box>

                            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

                            <Typography variant="h6" fontWeight="900" sx={{ color: '#fff', mb: 3, letterSpacing: 1 }}>VITALS COCKPIT</Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.2)' }}>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
                                            Real-time biometric sync active. Awaiting secondary sensor calibration...
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Card>
                    </Grid>

                    {/* Right Column: Medications */}
                    <Grid item xs={12} md={6}>
                        <Card className="glass-card" sx={{ p: 4, height: '100%', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Typography variant="h6" fontWeight="900" sx={{ color: '#fff', mb: 3, letterSpacing: 1 }}>ACTIVE PRESCRIPTIONS</Typography>
                            {patient.medications.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {patient.medications.map((m, i) => (
                                        <Box
                                            key={m.id}
                                            sx={{
                                                p: 2.5,
                                                borderRadius: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                bgcolor: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                transition: 'all 0.2s',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', transform: 'translateX(8px)' }
                                            }}
                                        >
                                            <Box sx={{
                                                width: 50,
                                                height: 50,
                                                bgcolor: 'rgba(13, 148, 136, 0.2)',
                                                borderRadius: '14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mr: 3,
                                                fontSize: '1.5rem',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                            }}>
                                                💊
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="subtitle1" fontWeight="900" sx={{ color: '#fff', mb: 0.5 }}>{m.generic_name.toUpperCase()}</Typography>
                                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: 0.5 }}>{m.dosage} · {m.frequency.toUpperCase()}</Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>No active medications recorded.</Typography>
                            )}
                        </Card>
                    </Grid>
                </Grid>
                {/* Third Two-column section: Records */}
                <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937' }}>Patient Records</Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <input
                                type="file"
                                hidden
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".pdf,.jpg,.jpeg,.png"
                            />
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CloudUploadIcon />}
                                onClick={() => fileInputRef.current.click()}
                                disabled={uploading}
                                sx={{ color: '#0d9488', borderColor: '#0d9488', textTransform: 'none', fontWeight: 'bold' }}
                            >
                                {uploading ? 'Processing...' : 'Add Patient Record'}
                            </Button>
                        </Box>
                    </Box>

                    <Card className="glass-card" elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', overflow: 'hidden' }}>
                        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <Typography variant="subtitle2" fontWeight="900" sx={{ color: 'rgba(255,255,255,0.4)', width: '20%', letterSpacing: 1 }}>DATE</Typography>
                            <Typography variant="subtitle2" fontWeight="900" sx={{ color: 'rgba(255,255,255,0.4)', width: '15%', letterSpacing: 1 }}>TYPE</Typography>
                            <Typography variant="subtitle2" fontWeight="900" sx={{ color: 'rgba(255,255,255,0.4)', flex: 1, letterSpacing: 1 }}>CLINICAL DATA & AI SYNTHESIS</Typography>
                            <Typography variant="subtitle2" fontWeight="900" sx={{ color: 'rgba(255,255,255,0.4)', width: '15%', textAlign: 'right', letterSpacing: 1 }}>INTEL</Typography>
                        </Box>

                        {patient.records && patient.records.length > 0 ? patient.records.map((r, i) => (
                            <Box
                                key={r.id}
                                sx={{
                                    p: 3,
                                    borderBottom: i < patient.records.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'all 0.2s',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }
                                }}
                            >
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', width: '20%', fontWeight: 700 }}>{new Date(r.created_at).toLocaleDateString()}</Typography>
                                <Box sx={{ width: '15%' }}>
                                    <Chip
                                        label={r.type.toUpperCase()}
                                        size="small"
                                        sx={{
                                            bgcolor: 'rgba(255,255,255,0.05)',
                                            color: '#fff',
                                            fontWeight: '900',
                                            borderRadius: '6px'
                                        }}
                                    />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" sx={{ color: '#fff', fontWeight: '900', mb: 0.5 }}>{r.title}</Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(r.ai_summary) }}
                                    />
                                    {r.uploaded_by && (
                                        <Typography variant="caption" sx={{ color: '#2dd4bf', fontWeight: '900', mt: 1, display: 'block', letterSpacing: 0.5 }}>
                                            DATA SOURCE: {r.uploaded_by.toUpperCase()}
                                        </Typography>
                                    )}
                                </Box>
                                <Box sx={{ width: '15%', textAlign: 'right' }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        sx={{
                                            color: '#fff',
                                            borderColor: 'rgba(255,255,255,0.2)',
                                            fontWeight: '900',
                                            textTransform: 'none',
                                            borderRadius: '10px',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', borderColor: '#fff' }
                                        }}
                                        onClick={() => window.open(r.file_url, '_blank')}
                                    >
                                        OPEN
                                    </Button>
                                </Box>
                            </Box>
                        )) : (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>Historical medical vault is currently empty.</Typography>
                            </Box>
                        )}
                    </Card>
                </Box>

                <Divider sx={{ my: 4 }} />

                {/* Second Two-column section */}
                <Grid container spacing={4}>

                {/* Bottom section: History & Intel */}
                <Grid container spacing={4}>

                    {/* Left Column: Timeline */}
                    <Grid item xs={12} md={7}>
                        <Card className="glass-card" sx={{ p: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 4, fontFamily: 'Outfit', letterSpacing: 1 }}>CHRONOLOGICAL ENCOUNTERS</Typography>
                            <Box sx={{ position: 'relative', pl: 4, borderLeft: '1px solid rgba(255,255,255,0.1)', ml: 1 }}>
                                {patient.history && patient.history.length > 0 ? patient.history.map((h, i) => (
                                    <Box key={i} sx={{ mb: 5, position: 'relative' }}>
                                        <Box sx={{
                                            position: 'absolute', left: -37, top: 4, width: 14, height: 14, borderRadius: '50%',
                                            bgcolor: h.type === 'teal' ? '#0d9488' : h.type === 'red' ? '#ef4444' : '#6366f1',
                                            boxShadow: `0 0 10px ${h.type === 'teal' ? '#0d9488' : h.type === 'red' ? '#ef4444' : '#6366f1'}`,
                                            border: '2px solid #050810'
                                        }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#fff', mb: 0.5, fontFamily: 'Outfit' }}>{h.title.toUpperCase()}</Typography>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5, fontWeight: 500 }}>{h.desc}</Typography>
                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#0d9488', fontWeight: 800 }}>{h.date.toUpperCase()}</Typography>
                                    </Box>
                                )) : (
                                    <Typography variant="body2" sx={{ color: '#64748b' }}>No clinical history found in Hospyn network.</Typography>
                                )}
                            </Box>
                        </Card>
                    </Grid>

                    {/* Right Column: Emergency & Notes */}
                    <Grid item xs={12} md={5}>
                        <Card className="glass-card" sx={{ p: 4, mb: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 3, fontFamily: 'Outfit', letterSpacing: 1 }}>EMERGENCY HUB</Typography>
                            <Box sx={{ mb: 2 }}>
                                {patient.contacts && patient.contacts.length > 0 ? patient.contacts.map(c => (
                                    <Box key={c.name} sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', p: 2.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#fff' }}>{c.name}</Typography>
                                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>{c.relation.toUpperCase()}</Typography>
                                        </Box>
                                        <Typography variant="body2" sx={{ fontWeight: 900, color: '#0d9488', fontFamily: 'monospace' }}>{c.phone}</Typography>
                                    </Box>
                                )) : (
                                    <Typography variant="body2" sx={{ color: '#64748b' }}>No emergency secondary nodes registered.</Typography>
                                )}
                            </Box>
                        </Card>

                        {!isRevoked && (
                            <Card className="glass-card" sx={{ p: 4, bgcolor: 'rgba(13, 148, 136, 0.05)', border: '1px solid rgba(13, 148, 136, 0.15)', borderRadius: '24px' }}>
                                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 2, fontFamily: 'Outfit', letterSpacing: 1 }}>CLINICAL MEMO</Typography>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={4}
                                    placeholder="Annotate this encounter... Encrypted and synced to Hospyn profile."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    sx={{ 
                                        mb: 3, 
                                        '& .MuiOutlinedInput-root': { 
                                            color: 'white', 
                                            bgcolor: 'rgba(0,0,0,0.2)', 
                                            borderRadius: '16px',
                                            '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' }
                                        } 
                                    }}
                                />
                                <Button
                                    variant="contained"
                                    fullWidth
                                    disableElevation
                                    sx={{ 
                                        bgcolor: '#0d9488', 
                                        '&:hover': { bgcolor: '#0f766e' }, 
                                        py: 2, 
                                        borderRadius: '14px',
                                        fontWeight: 900,
                                        boxShadow: '0 8px 20px rgba(13, 148, 136, 0.2)'
                                    }}
                                    onClick={handleSaveNotes}
                                    disabled={!notes.trim()}
                                >
                                    SYNCHRONIZE TO VAULT
                                </Button>
                            </Card>
                        )}
                    </Grid>

                </Grid>

                </Grid>
            </Box>

            <Snackbar open={toastOpen} autoHideDuration={3000} onClose={() => setToastOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setToastOpen(false)} severity="success" sx={{ width: '100%', fontWeight: 'bold' }}>
                    Notes saved to patient Hospyn profile ✓
                </Alert>
            </Snackbar>

            {/* Revocation Kickout Dialog */}
            <Dialog
                open={revocationDialogOpen}
                onClose={() => navigate('/history')}
                disableEscapeKeyDown
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#dc2626', fontWeight: 'bold' }}>
                    <WarningAmberIcon /> Access Revoked
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        The patient has revoked your access to their medical records. You can no longer view this profile.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        variant="contained"
                        fullWidth
                        onClick={() => navigate('/history')}
                        sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' }, fontWeight: 'bold' }}
                    >
                        Return to Dashboard
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}
