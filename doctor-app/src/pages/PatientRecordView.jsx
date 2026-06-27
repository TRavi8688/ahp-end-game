import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, IconButton, Chip, Avatar, Grid, Card,
    CardContent, Divider, CircularProgress, Alert, Tooltip
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MedicationIcon from '@mui/icons-material/Medication';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';

/**
 * Read-only patient chart, looked up directly by Patient.id — this is the
 * counterpart to PatientDetailView.jsx for patients who aren't currently
 * checked in as a walk-in (reached from PatientList.jsx's "my patients"
 * and PatientSearch.jsx's Hospain ID lookup).
 *
 * There is no consultation-completion, intake, or notes form here on
 * purpose: those actions require an active walk-in (see
 * PatientDetailView.jsx), which a patient looked up this way may not have.
 * "Draft Prescription" is offered since that's the one clinical action
 * that only needs a Patient.id, not a walk-in.
 */
export default function PatientRecordView() {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPatient = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await apiClient.get(`/doctor/patient-record/${patientId}`);
                setPatient(data?.data || data);
            } catch (err) {
                console.error('Error fetching patient record:', err);
                setError(err.message || "Couldn't load this patient record.");
            } finally {
                setIsLoading(false);
            }
        };
        if (patientId) fetchPatient();
    }, [patientId]);

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <CircularProgress sx={{ color: '#0d9488' }} />
            </Box>
        );
    }

    if (error || !patient) {
        return (
            <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
                <IconButton onClick={() => navigate(-1)} sx={{ mb: 2 }}><ArrowBackIcon /></IconButton>
                <Alert severity="error" sx={{ borderRadius: 2 }}>{error || 'Patient not found.'}</Alert>
            </Box>
        );
    }

    const profile = patient.profile || {};

    return (
        <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, p: 1.5, bgcolor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
                <IconButton onClick={() => navigate(-1)} sx={{ mr: 1, color: '#fff' }}><ArrowBackIcon /></IconButton>
                <Typography variant="body1" fontWeight="900" sx={{ color: '#fff', pr: 2 }}>BACK</Typography>
            </Box>

            <Card sx={{ p: 4, mb: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '32px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 3 }}>
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <Avatar sx={{ width: 80, height: 80, bgcolor: '#0d9488', fontSize: '2rem', fontWeight: 900 }}>
                            {(profile.name || 'P')[0]}
                        </Avatar>
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: 'Outfit', mb: 0.5 }}>{profile.name}</Typography>
                            <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                                {profile.age ? `${profile.age} Years` : 'Age unknown'} · {profile.gender || 'Unknown'} · {profile.blood_group || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#0d9488', fontWeight: 700 }}>{profile.hospyn_id}</Typography>
                        </Box>
                    </Box>
                    <Tooltip title="This patient isn't checked in today, but a standalone prescription can still be written.">
                        <Button variant="contained" startIcon={<MedicationIcon />}
                            onClick={() => navigate(`/prescriptions/${profile.id}`, { state: { patient: profile } })}
                            sx={{ bgcolor: '#0d9488', px: 4, py: 1.5, borderRadius: '16px', fontWeight: 900, '&:hover': { bgcolor: '#0f766e' } }}>
                            Draft Prescription
                        </Button>
                    </Tooltip>
                </Box>
            </Card>

            <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
                This patient isn't currently checked in. Saving consultation notes or recording a baseline
                intake requires an active visit — open them from the queue once they've checked in.
            </Alert>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Card sx={{ p: 3, bgcolor: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '24px', height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <WarningAmberIcon sx={{ color: '#ef4444' }} />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>Allergies</Typography>
                        </Box>
                        {(patient.allergies || []).length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#64748b' }}>No known allergies recorded.</Typography>
                        ) : (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {patient.allergies.map(a => (
                                    <Chip key={a.id} label={a.allergen} sx={{ bgcolor: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700 }} />
                                ))}
                            </Box>
                        )}
                    </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Card sx={{ p: 3, bgcolor: 'rgba(13,148,136,0.04)', border: '1px solid rgba(13,148,136,0.15)', borderRadius: '24px', height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <LocalHospitalIcon sx={{ color: '#0d9488' }} />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>Chronic Conditions</Typography>
                        </Box>
                        {(patient.conditions || []).length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#64748b' }}>No chronic conditions recorded.</Typography>
                        ) : (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {patient.conditions.map(c => (
                                    <Chip key={c.id} label={c.name} sx={{ bgcolor: 'rgba(13,148,136,0.1)', color: '#0d9488', fontWeight: 700 }} />
                                ))}
                            </Box>
                        )}
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Current Medications</Typography>
                        {(patient.medications || []).length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#64748b' }}>No medications on record.</Typography>
                        ) : (
                            <Grid container spacing={2}>
                                {patient.medications.map(m => (
                                    <Grid item xs={12} sm={6} key={m.id}>
                                        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 700 }}>{m.generic_name}</Typography>
                                            <Typography variant="caption" sx={{ color: '#64748b' }}>{m.dosage} · {m.frequency}</Typography>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Medical Records</Typography>
                        {(patient.records || []).length === 0 ? (
                            <Typography variant="body2" sx={{ color: '#64748b' }}>No records on file.</Typography>
                        ) : (
                            <>
                                {patient.records.map(r => (
                                    <Box key={r.id} sx={{ py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{r.type}</Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                                        </Typography>
                                    </Box>
                                ))}
                            </>
                        )}
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
