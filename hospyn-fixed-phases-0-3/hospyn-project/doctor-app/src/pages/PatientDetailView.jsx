import React, { useState } from 'react';
import {
    Box, Typography, Button, IconButton, Chip, Avatar, Grid, Card,
    CardContent, Divider, TextField, Snackbar, Alert, Dialog,
    DialogTitle, DialogContent, DialogActions, CircularProgress
} from '@mui/material';
import DOMPurify from 'dompurify';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { API_BASE_URL } from '../api';
import ApiService from '../utils/ApiService';
import { clinicalService } from '../services/clinicalService';
import IntakeModal from '../components/IntakeModal';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MedicationIcon from '@mui/icons-material/Medication';
import EditNoteIcon from '@mui/icons-material/EditNote';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LockIcon from '@mui/icons-material/Lock';
import SaveIcon from '@mui/icons-material/Save';

export default function PatientDetailView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { lastMessage } = useSocket();
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notes, setNotes] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [toastSeverity, setToastSeverity] = useState('success');
    const [isRevoked, setIsRevoked] = useState(false);
    const [revocationDialogOpen, setRevocationDialogOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef(null);

    const [requestSent, setRequestSent] = useState(false);
    const [isSendingRequest, setIsSendingRequest] = useState(false);
    const [intakeModalOpen, setIntakeModalOpen] = useState(false);
    const [requestingVitals, setRequestingVitals] = useState(false);

    const vitalsRecords = patient?.records?.filter(r => r.type === 'vitals' || r.type === 'Vitals') || [];
    const latestVitals = vitalsRecords[0]?.ai_extracted;

    const showToast = (msg, severity = 'success') => {
        setToastMsg(msg);
        setToastSeverity(severity);
        setToastOpen(true);
    };

    const fetchPatient = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await ApiService.get(`/doctor/patient/${id}`);
            const data = res?.data || res;
            if (data) {
                data.allergies = data.allergies || [];
                data.conditions = data.conditions || [];
                data.medications = data.medications || [];
                data.records = data.records || [];
                data.history = data.history || [];
                data.contacts = data.contacts || [];
            }
            setPatient(data);
        } catch (error) {
            console.error('Error fetching patient:', error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    React.useEffect(() => { fetchPatient(false); }, [id]);

    React.useEffect(() => {
        if (patient?.profile?.id) {
            ApiService.post(`/doctor/treatment/${patient.profile.id}/start`).catch(console.error);
            return () => {
                ApiService.post(`/doctor/treatment/${patient.profile.id}/end`).catch(console.error);
            };
        }
    }, [patient?.profile?.id]);

    React.useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'access_revoked') {
            setIsRevoked(true);
            setRevocationDialogOpen(true);
            setRequestSent(false);
        }
        if (lastMessage.type === 'patient_update' || lastMessage.type === 'access_granted') {
            fetchPatient(true);
            showToast('Patient data updated in real-time');
            if (lastMessage.type === 'access_granted') setRequestSent(false);
        }
    }, [lastMessage]);

    const handleRequestAccess = async () => {
        setIsSendingRequest(true);
        try {
            await ApiService.post('/doctor/scan-patient', {
                hospyn_id: patient?.profile?.hospyn_id,
                clinic_name: 'Hospyn Clinic',
                access_level: 'full'
            });
            setRequestSent(true);
            showToast('Consent request dispatched to patient app ✔');
        } catch (error) {
            alert(error.response?.data?.detail || 'Network error, please try again.');
        } finally {
            setIsSendingRequest(false);
        }
    };

    const handleRequestVitals = async () => {
        if (!patient?.profile?.id) return;
        setRequestingVitals(true);
        try {
            await ApiService.post(`/doctor/patient/${patient.profile.id}/request-vitals`);
            showToast('Vitals request sent to nursing staff!');
        } catch (error) {
            showToast('Failed to send vitals request.', 'error');
        } finally {
            setRequestingVitals(false);
        }
    };

    // FIX: handleSaveNotes now actually calls POST /consultations
    const handleSaveNotes = async () => {
        if (!notes.trim()) return;
        setSavingNotes(true);
        try {
            await clinicalService.saveConsultationNotes(
                patient?.profile?.id || id,
                notes,
                diagnosis
            );
            showToast('Notes saved to patient Hospyn profile ✔');
            setNotes('');
            setDiagnosis('');
        } catch (error) {
            console.error('Save notes error:', error);
            showToast('Failed to save notes. Please try again.', 'error');
        } finally {
            setSavingNotes(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            await ApiService.client.post(`/doctor/patient/${patient?.profile?.hospyn_id}/upload-report`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast('Report uploaded successfully ✔');
            fetchPatient(true);
        } catch (error) {
            showToast('Upload failed. Please try again.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleVerifyRecord = async (recordId) => {
        const updatedRecords = patient?.records?.map(r => r.id === recordId ? { ...r, verified: true } : r);
        setPatient(prev => ({ ...prev, records: updatedRecords }));
        try {
            await ApiService.post(`/clinical/records/${recordId}/verify`);
            showToast('Record verified and signed ✔');
            fetchPatient(true);
        } catch (error) {
            fetchPatient(true);
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress sx={{ color: '#0d9488' }} />
            </Box>
        );
    }

    if (!patient) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" sx={{ color: '#fff' }}>Patient not found or access denied.</Typography>
                <Button onClick={() => navigate('/patients')} sx={{ mt: 2, color: '#0d9488' }}>Back to Patients</Button>
            </Box>
        );
    }

    // Consent required state
    if (patient.consent_required) {
        return (
            <Box sx={{ maxWidth: 800, mx: 'auto', mt: 8, pb: 8, px: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, p: 1.5, bgcolor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
                    <IconButton onClick={() => navigate(-1)} sx={{ mr: 1, color: '#fff' }}><ArrowBackIcon /></IconButton>
                    <Typography variant="body1" fontWeight="900" sx={{ color: '#fff', pr: 2 }}>BACK TO ROSTER</Typography>
                </Box>
                <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(30px)', color: 'white', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.05)', p: 6, textAlign: 'center' }}>
                    <Box sx={{ width: 100, height: 100, borderRadius: '35%', bgcolor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 4, border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 0 40px rgba(99,102,241,0.2)' }}>
                        <LockIcon sx={{ color: '#6366f1', fontSize: 45 }} />
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, fontFamily: 'Outfit', mb: 2 }}>Medical Vault Locked</Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', maxWidth: 500, mx: 'auto', mb: 4, lineHeight: 1.8 }}>
                        You do not have access to this patient's medical records yet. Please request consent to view their history.
                    </Typography>
                    <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', maxWidth: 450, mx: 'auto', mb: 5 }}>
                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800, display: 'block', mb: 0.5 }}>PATIENT IDENTITY</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', mb: 1 }}>{patient?.profile?.name}</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#0d9488', fontWeight: 700 }}>{patient?.profile?.hospyn_id}</Typography>
                    </Box>
                    {requestSent ? (
                        <Box sx={{ py: 2 }}>
                            <CircularProgress size={60} thickness={2} sx={{ color: '#0d9488', mb: 3 }} />
                            <Typography variant="h5" sx={{ fontWeight: 900, color: '#2dd4bf', mb: 1 }}>Awaiting Patient Approval...</Typography>
                            <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 400, mx: 'auto' }}>
                                A secure request was sent to {patient?.profile?.name}'s Hospyn app.
                            </Typography>
                        </Box>
                    ) : (
                        <Button variant="contained" disabled={isSendingRequest} onClick={handleRequestAccess}
                            sx={{ bgcolor: '#6366f1', color: '#fff', px: 6, py: 2.2, borderRadius: '20px', fontWeight: 900, fontSize: '1.1rem', boxShadow: '0 10px 25px rgba(99,102,241,0.4)', '&:hover': { bgcolor: '#4f46e5' } }}>
                            {isSendingRequest ? 'Sending Request...' : 'Request Vault Access'}
                        </Button>
                    )}
                </Card>
            </Box>
        );
    }

    const isNewPatient = !patient?.conditions?.length && !patient?.medications?.length && !patient?.records?.length;

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 8 }}>
            {/* Top Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, p: 1.5, bgcolor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
                <IconButton onClick={() => navigate(-1)} sx={{ mr: 1, color: '#fff' }}><ArrowBackIcon /></IconButton>
                <Typography variant="body1" fontWeight="900" sx={{ color: '#fff', pr: 2 }}>BACK TO ROSTER</Typography>
            </Box>

            {isRevoked && (
                <Box sx={{ bgcolor: '#fee2e2', border: '1px solid #fca5a5', p: 2, borderRadius: 2, mb: 3, display: 'flex', alignItems: 'center' }}>
                    <WarningAmberIcon sx={{ color: '#dc2626', mr: 2 }} />
                    <Typography variant="body1" sx={{ color: '#b91c1c', fontWeight: 'bold' }}>
                        ⚠ Patient has revoked your access. You can only see previously cached data.
                    </Typography>
                </Box>
            )}

            <Box sx={{ opacity: isRevoked ? 0.4 : 1 }} style={{ pointerEvents: isRevoked ? 'none' : 'auto' }}>
                {/* Patient Header */}
                <Card elevation={0} sx={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(30px)', color: 'white', borderRadius: '40px', mb: 4, border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                    <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #0d9488, #6366f1)' }} />
                    <Box sx={{ p: { xs: 4, md: 6 }, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
                        <Avatar sx={{ width: 120, height: 120, bgcolor: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: '3.5rem', fontWeight: 900, border: '1px solid rgba(99,102,241,0.3)', fontFamily: 'Outfit' }}>
                            {(patient?.profile?.name || 'U').split(' ').map(n => n[0]).join('')}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 300 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                                <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'Outfit', letterSpacing: '-2px' }}>{patient?.profile?.name}</Typography>
                                <Chip label="VERIFIED IDENTITY" size="small" sx={{ bgcolor: 'rgba(13,148,136,0.1)', color: '#0d9488', fontWeight: 900, fontSize: '0.65rem', height: 24, border: '1px solid rgba(13,148,136,0.2)' }} />
                            </Box>
                            <Typography variant="h6" sx={{ color: '#64748b', mb: 3, fontWeight: 600 }}>
                                {patient?.profile?.age} Years · {patient?.profile?.gender} · <Box component="span" sx={{ color: '#fff', fontWeight: 800 }}>{patient?.profile?.blood_group}</Box>
                            </Typography>
                            <Box sx={{ px: 2, py: 0.8, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', display: 'inline-block' }}>
                                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800, mr: 1 }}>Hospyn ID:</Typography>
                                <Typography component="span" sx={{ color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>{patient?.profile?.hospyn_id}</Typography>
                            </Box>
                        </Box>
                        <Button variant="contained" startIcon={<MedicationIcon />}
                            onClick={() => navigate(`/prescriptions/${id}`, { state: { patient: patient.profile } })}
                            sx={{ bgcolor: '#0d9488', px: 5, py: 1.8, borderRadius: '18px', fontWeight: 900, fontSize: '1rem', boxShadow: '0 8px 20px rgba(13,148,136,0.3)', '&:hover': { bgcolor: '#0f766e' } }}>
                            Draft Prescription
                        </Button>
                    </Box>
                </Card>

                {/* New patient intake banner */}
                {isNewPatient && (
                    <Card elevation={0} sx={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.25)', p: 4, borderRadius: '24px', mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Box sx={{ p: 2, bgcolor: 'rgba(245,158,11,0.15)', borderRadius: '16px', border: '1px solid rgba(245,158,11,0.3)' }}>
                                <SmartToyIcon sx={{ color: '#f59e0b', fontSize: 32 }} />
                            </Box>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 900, color: '#f59e0b', fontFamily: 'Outfit' }}>NEW HOSPYN MEMBER: BASELINE HEALTH INTAKE REQUIRED</Typography>
                                <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>This patient has no clinical history. Initialize their digital health passport.</Typography>
                            </Box>
                        </Box>
                        <Button variant="contained" onClick={() => setIntakeModalOpen(true)}
                            sx={{ background: 'linear-gradient(45deg, #f59e0b, #d97706)', color: 'white', px: 4, py: 1.5, borderRadius: '16px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                            Launch Baseline Intake
                        </Button>
                    </Card>
                )}

                {/* Allergy Alert */}
                {patient?.allergies?.length > 0 ? (
                    <Box sx={{ background: 'rgba(239,68,68,0.05)', p: 3, borderRadius: '24px', mb: 4, display: 'flex', alignItems: 'center', gap: 3, border: '1px solid rgba(239,68,68,0.15)' }}>
                        <Box sx={{ p: 1.5, bgcolor: '#ef4444', borderRadius: '14px' }}>
                            <WarningAmberIcon sx={{ color: 'white' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ color: '#f87171', fontWeight: 900 }}>CRITICAL CONTRAINDICATIONS</Typography>
                            <Typography variant="body2" sx={{ color: '#64748b' }}>Detected hypersensitivity patterns. Exercise high clinical caution.</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                            {patient.allergies.map(a => (
                                <Chip key={a.id} label={`${a.allergen} (${a.severity})`} sx={{ bgcolor: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 900, border: '1px solid rgba(239,68,68,0.2)' }} />
                            ))}
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ background: 'rgba(20,184,166,0.05)', p: 2.5, borderRadius: '24px', mb: 4, display: 'flex', alignItems: 'center', gap: 2.5, border: '1px solid rgba(20,184,166,0.1)' }}>
                        <Box sx={{ p: 1, bgcolor: '#14b8a6', borderRadius: '10px' }}><CheckCircleOutlinedIcon sx={{ color: 'white', fontSize: 20 }} /></Box>
                        <Typography variant="body2" sx={{ color: '#2dd4bf', fontWeight: 800 }}>CLEARED: NO KNOWN ALLERGIES ENCOUNTERED</Typography>
                    </Box>
                )}

                {/* AI Summary */}
                <Card elevation={0} sx={{ background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.1)', mb: 5, borderRadius: '32px', overflow: 'hidden' }}>
                    <Box sx={{ p: 5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                                <Box sx={{ p: 1.2, bgcolor: '#6366f1', borderRadius: '14px', display: 'flex', boxShadow: '0 6px 20px rgba(99,102,241,0.4)' }}>
                                    <SmartToyIcon sx={{ color: '#fff' }} />
                                </Box>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Outfit' }}>INTELLIGENCE CONTEXT</Typography>
                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>SYNTHESIZED BY HOSPYN CORE</Typography>
                                </Box>
                            </Box>
                            <Chip label="PRECISION ANALYSIS" sx={{ background: 'linear-gradient(45deg, #6366f1, #a855f7)', color: 'white', fontWeight: 900, fontSize: '0.7rem' }} />
                        </Box>
                        <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography variant="h6" sx={{ color: '#cbd5e1', lineHeight: 1.8, fontWeight: 500 }}
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(patient.ai_summary || 'Synthesizing clinical data...') }} />
                        </Box>
                    </Box>
                </Card>

                {/* Conditions & Vitals / Medications */}
                <Grid container spacing={4} sx={{ mb: 4 }}>
                    <Grid item xs={12} md={6}>
                        <Card sx={{ p: 4, height: '100%', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px' }}>
                            <Typography variant="h6" fontWeight="900" sx={{ color: '#fff', mb: 3 }}>CLINICAL CONDITIONS</Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 4 }}>
                                {patient?.conditions?.length > 0
                                    ? patient.conditions.map(c => <Chip key={c.id} label={c.name.toUpperCase()} sx={{ bgcolor: 'rgba(13,148,136,0.2)', color: '#2dd4bf', fontWeight: 900, border: '1px solid rgba(45,212,191,0.3)' }} />)
                                    : <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>No conditions recorded.</Typography>
                                }
                            </Box>
                            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />
                            <Typography variant="h6" fontWeight="900" sx={{ color: '#fff', mb: 3 }}>VITALS COCKPIT</Typography>
                            {latestVitals ? (
                                <Grid container spacing={2}>
                                    {[
                                        { label: 'Heart Rate', value: latestVitals.heartRate?.value, unit: 'bpm', color: '#f43f5e', bg: 'rgba(244,63,94,0.05)', border: 'rgba(244,63,94,0.1)' },
                                        { label: 'Blood Pressure', value: latestVitals.bloodPressure?.value, unit: '', color: '#3b82f6', bg: 'rgba(59,130,246,0.05)', border: 'rgba(59,130,246,0.1)' },
                                        { label: 'SpO₂', value: latestVitals.bloodOxygen?.value, unit: '%', color: '#10b981', bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.1)' },
                                        { label: 'Temperature', value: latestVitals.temperature?.value, unit: '°F', color: '#f59e0b', bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.1)' },
                                    ].map(v => (
                                        <Grid item xs={6} key={v.label}>
                                            <Box sx={{ p: 2, bgcolor: v.bg, borderRadius: '16px', border: `1px solid ${v.border}` }}>
                                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{v.label}</Typography>
                                                <Typography variant="h5" sx={{ color: v.color, fontWeight: 'bold', mt: 1 }}>
                                                    {v.value || 'N/A'} <span style={{ fontSize: '12px', color: '#64748b' }}>{v.unit}</span>
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    ))}
                                </Grid>
                            ) : (
                                <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>No active vitals recorded.</Typography>
                                    <Button variant="contained" color="primary" fullWidth onClick={handleRequestVitals} disabled={requestingVitals} sx={{ borderRadius: '12px', py: 1.2, fontWeight: 'bold' }}>
                                        {requestingVitals ? 'Sending Request...' : 'Request Nurse for Vitals'}
                                    </Button>
                                </Box>
                            )}
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Card sx={{ p: 4, height: '100%', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px' }}>
                            <Typography variant="h6" fontWeight="900" sx={{ color: '#fff', mb: 3 }}>ACTIVE PRESCRIPTIONS</Typography>
                            {patient?.medications?.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {patient.medications.map(m => (
                                        <Box key={m.id} sx={{ p: 2.5, borderRadius: '20px', display: 'flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', transform: 'translateX(8px)' } }}>
                                            <Box sx={{ width: 50, height: 50, bgcolor: 'rgba(13,148,136,0.2)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 3, fontSize: '1.5rem' }}>💊</Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="subtitle1" fontWeight="900" sx={{ color: '#fff', mb: 0.5 }}>{m.generic_name?.toUpperCase()}</Typography>
                                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{m.dosage} · {m.frequency?.toUpperCase()}</Typography>
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

                {/* Records */}
                <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ color: '#fff' }}>Patient Records</Typography>
                        <Box>
                            <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png" />
                            <Button size="small" variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => fileInputRef.current.click()} disabled={uploading} sx={{ color: '#0d9488', borderColor: '#0d9488', fontWeight: 'bold' }}>
                                {uploading ? 'Processing...' : 'Add Patient Record'}
                            </Button>
                        </Box>
                    </Box>
                    <Card elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', overflow: 'hidden' }}>
                        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            {['DATE', 'TYPE', 'CLINICAL DATA & AI SYNTHESIS', 'INTEL'].map((h, i) => (
                                <Typography key={h} variant="subtitle2" fontWeight="900" sx={{ color: 'rgba(255,255,255,0.4)', width: i === 0 ? '20%' : i === 1 ? '15%' : i === 2 ? 'auto' : '15%', flex: i === 2 ? 1 : undefined, textAlign: i === 3 ? 'right' : 'left' }}>{h}</Typography>
                            ))}
                        </Box>
                        {patient.records?.length > 0 ? patient.records.map((r, i) => (
                            <Box key={r.id} sx={{ p: 3, borderBottom: i < patient.records.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', alignItems: 'center', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', width: '20%', fontWeight: 700 }}>{new Date(r.created_at).toLocaleDateString()}</Typography>
                                <Box sx={{ width: '15%' }}><Chip label={r.type?.toUpperCase()} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 900, borderRadius: '6px' }} /></Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" sx={{ color: '#fff', fontWeight: 900, mb: 0.5 }}>{r.title}</Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(r.ai_summary || '') }} />
                                </Box>
                                <Box sx={{ width: '15%', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Button variant="outlined" size="small" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', fontWeight: 900, borderRadius: '10px' }} onClick={() => window.open(r.file_url, '_blank')}>OPEN</Button>
                                    {r.needs_verification ? (
                                        <Button variant="contained" size="small" startIcon={<CheckCircleOutlinedIcon />} sx={{ bgcolor: '#14b8a6', color: '#fff', fontWeight: 900, borderRadius: '10px', fontSize: '0.7rem' }} onClick={() => handleVerifyRecord(r.id)}>VERIFY</Button>
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#10b981', justifyContent: 'flex-end' }}>
                                            <CheckCircleOutlinedIcon sx={{ fontSize: 16 }} />
                                            <Typography variant="caption" sx={{ fontWeight: 900 }}>VERIFIED</Typography>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        )) : (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>Historical medical vault is currently empty.</Typography>
                            </Box>
                        )}
                    </Card>
                </Box>

                <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }} />

                {/* History & Emergency */}
                <Grid container spacing={4}>
                    <Grid item xs={12} md={7}>
                        <Card sx={{ p: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 4, fontFamily: 'Outfit' }}>CHRONOLOGICAL ENCOUNTERS</Typography>
                            <Box sx={{ position: 'relative', pl: 4, borderLeft: '1px solid rgba(255,255,255,0.1)', ml: 1 }}>
                                {patient.history?.length > 0 ? patient.history.map((h, i) => (
                                    <Box key={i} sx={{ mb: 5, position: 'relative' }}>
                                        <Box sx={{ position: 'absolute', left: -37, top: 4, width: 14, height: 14, borderRadius: '50%', bgcolor: h.type === 'teal' ? '#0d9488' : h.type === 'red' ? '#ef4444' : '#6366f1', border: '2px solid #050810' }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#fff', mb: 0.5 }}>{h.title?.toUpperCase()}</Typography>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5 }}>{h.desc}</Typography>
                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#0d9488', fontWeight: 800 }}>{h.date?.toUpperCase()}</Typography>
                                    </Box>
                                )) : (
                                    <Typography variant="body2" sx={{ color: '#64748b' }}>No clinical history found in Hospyn network.</Typography>
                                )}
                            </Box>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={5}>
                        <Card sx={{ p: 4, mb: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 3 }}>EMERGENCY HUB</Typography>
                            {patient.contacts?.length > 0 ? patient.contacts.map(c => (
                                <Box key={c.name} sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', p: 2.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#fff' }}>{c.name}</Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>{c.relation?.toUpperCase()}</Typography>
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#0d9488', fontFamily: 'monospace' }}>{c.phone}</Typography>
                                </Box>
                            )) : (
                                <Typography variant="body2" sx={{ color: '#64748b' }}>No emergency contacts registered.</Typography>
                            )}
                        </Card>

                        {/* FIX: Clinical Memo now actually saves notes via POST /consultations */}
                        {!isRevoked && (
                            <Card sx={{ p: 4, bgcolor: 'rgba(13,148,136,0.05)', border: '1px solid rgba(13,148,136,0.15)', borderRadius: '24px' }}>
                                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 2 }}>CLINICAL MEMO</Typography>
                                <TextField fullWidth label="Diagnosis" placeholder="e.g. Acute Bronchitis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
                                    sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'white', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } }, '& .MuiInputLabel-root': { color: '#64748b' } }} />
                                <TextField fullWidth multiline rows={4} placeholder="Annotate this encounter... Encrypted and synced to Hospyn profile." value={notes} onChange={(e) => setNotes(e.target.value)}
                                    sx={{ mb: 3, '& .MuiOutlinedInput-root': { color: 'white', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '16px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }} />
                                <Button variant="contained" fullWidth disableElevation startIcon={savingNotes ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                                    sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' }, py: 2, borderRadius: '14px', fontWeight: 900, boxShadow: '0 8px 20px rgba(13,148,136,0.2)' }}
                                    onClick={handleSaveNotes} disabled={!notes.trim() || savingNotes}>
                                    {savingNotes ? 'SAVING...' : 'SYNCHRONIZE TO VAULT'}
                                </Button>
                            </Card>
                        )}
                    </Grid>
                </Grid>
            </Box>

            <Snackbar open={toastOpen} autoHideDuration={3000} onClose={() => setToastOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setToastOpen(false)} severity={toastSeverity} sx={{ width: '100%', fontWeight: 'bold' }}>{toastMsg}</Alert>
            </Snackbar>

            <Dialog open={revocationDialogOpen} onClose={() => navigate('/history')} disableEscapeKeyDown>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#dc2626', fontWeight: 'bold' }}>
                    <WarningAmberIcon /> Access Revoked
                </DialogTitle>
                <DialogContent>
                    <Typography>The patient has revoked your access to their medical records.</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button variant="contained" fullWidth onClick={() => navigate('/history')} sx={{ bgcolor: '#dc2626', fontWeight: 'bold' }}>Return to Dashboard</Button>
                </DialogActions>
            </Dialog>

            <IntakeModal open={intakeModalOpen} onClose={() => setIntakeModalOpen(false)} patientId={id} onComplete={() => { setIntakeModalOpen(false); fetchPatient(true); }} />
        </Box>
    );
}
