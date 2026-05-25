import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, TextField, Grid, Card, CardContent, Divider, Snackbar, Alert, Chip, CircularProgress, Select, MenuItem, InputLabel, FormControl } from '@mui/material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MedicationIcon from '@mui/icons-material/Medication';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { API_BASE_URL } from '../api';
import { clinicalService } from '../services/clinicalService';

export default function PrescriptionBuilder() {
    const navigate = useNavigate();
    const { patientId } = useParams();
    const location = useLocation();
    
    // We can potentially pass patient context through route state
    const [patient, setPatient] = useState(location.state?.patient || null);
    
    const [medications, setMedications] = useState([
        { medication_name: '', dosage: '', frequency: '1-0-1', duration: '5 days', route: 'Oral', instructions: '' }
    ]);
    const [diagnosis, setDiagnosis] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

    useEffect(() => {
        // Fetch patient details if not passed in state and if patientId exists
        if (!patient && patientId) {
            const fetchPatient = async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/doctor/patient/${patientId}`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setPatient(data.profile); // Assuming data.profile has what we need
                    }
                } catch (error) {
                    console.error("Error fetching patient", error);
                }
            };
            fetchPatient();
        }
    }, [patientId, patient]);

    const handleAddMedication = () => {
        setMedications([...medications, { medication_name: '', dosage: '', frequency: '1-0-1', duration: '5 days', route: 'Oral', instructions: '' }]);
    };

    const handleRemoveMedication = (index) => {
        const newMeds = [...medications];
        newMeds.splice(index, 1);
        setMedications(newMeds);
    };

    const handleChange = (index, field, value) => {
        const newMeds = [...medications];
        newMeds[index][field] = value;
        setMedications(newMeds);
    };

    const handleSubmit = async () => {
        if (!patientId) {
            setToast({ open: true, message: 'No patient selected.', type: 'error' });
            return;
        }
        
        // Filter out empty medications
        const validMedications = medications.filter(m => m.medication_name.trim() !== '');
        
        if (validMedications.length === 0 && !diagnosis.trim()) {
            setToast({ open: true, message: 'Please add at least one medication or diagnosis.', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                patient_id: patientId,
                diagnosis: diagnosis || 'Clinical Consultation',
                medications: validMedications.map(m => ({
                    name: m.medication_name,
                    dosage: m.dosage,
                    frequency: m.frequency,
                    duration: m.duration,
                    instructions: m.instructions
                })),
                notes: `Follow up: ${followUpDate || 'As needed'}`
            };

            await clinicalService.createPrescription(payload);
            setToast({ open: true, message: 'Prescription drafted securely!', type: 'success' });
            setTimeout(() => {
                navigate(`/patient/${patientId}`);
            }, 1500);
        } catch (error) {
            console.error(error);
            setToast({ open: true, message: error.message || 'Failed to submit prescription', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', pb: 8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, p: 1.5, bgcolor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content' }}>
                <IconButton onClick={() => navigate(-1)} sx={{ mr: 1, color: '#fff' }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="body1" fontWeight="900" sx={{ color: '#fff', pr: 2 }}>BACK TO PATIENT</Typography>
            </Box>

            <Card className="glass-card" elevation={0} sx={{ p: 4, mb: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Box sx={{ p: 1.5, bgcolor: 'rgba(13, 148, 136, 0.1)', borderRadius: '14px', border: '1px solid rgba(13, 148, 136, 0.2)' }}>
                        <MedicationIcon sx={{ color: '#0d9488', fontSize: 32 }} />
                    </Box>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Syne', letterSpacing: '-1px' }}>
                            Prescription Builder
                        </Typography>
                        {patient && (
                            <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                                Prescribing for: <Box component="span" sx={{ color: '#fff', fontWeight: 800 }}>{patient.name}</Box> ({patient.hospyn_id})
                            </Typography>
                        )}
                    </Box>
                </Box>
                
                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} md={8}>
                        <TextField
                            fullWidth
                            label="Clinical Diagnosis"
                            placeholder="e.g. Acute Bronchitis"
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            InputLabelProps={{ style: { color: '#64748b' } }}
                            inputProps={{ style: { color: 'white' } }}
                            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            type="date"
                            label="Follow-up Date"
                            value={followUpDate}
                            onChange={(e) => setFollowUpDate(e.target.value)}
                            InputLabelProps={{ shrink: true, style: { color: '#64748b' } }}
                            inputProps={{ style: { color: 'white' } }}
                            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                        />
                    </Grid>
                </Grid>

                <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', mb: 2, fontFamily: 'Outfit' }}>Medications</Typography>
                
                {medications.map((med, index) => (
                    <Box key={index} sx={{ p: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                        {medications.length > 1 && (
                            <IconButton 
                                onClick={() => handleRemoveMedication(index)}
                                sx={{ position: 'absolute', top: 8, right: 8, color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' } }}
                                size="small"
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        )}
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth
                                    label="Medication Name"
                                    placeholder="e.g. Amoxicillin"
                                    value={med.medication_name}
                                    onChange={(e) => handleChange(index, 'medication_name', e.target.value)}
                                    InputLabelProps={{ style: { color: '#64748b' } }}
                                    inputProps={{ style: { color: 'white' } }}
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                                />
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <TextField
                                    fullWidth
                                    label="Dosage"
                                    placeholder="e.g. 500mg"
                                    value={med.dosage}
                                    onChange={(e) => handleChange(index, 'dosage', e.target.value)}
                                    InputLabelProps={{ style: { color: '#64748b' } }}
                                    inputProps={{ style: { color: 'white' } }}
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                                />
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <TextField
                                    fullWidth
                                    label="Frequency"
                                    placeholder="e.g. 1-0-1"
                                    value={med.frequency}
                                    onChange={(e) => handleChange(index, 'frequency', e.target.value)}
                                    InputLabelProps={{ style: { color: '#64748b' } }}
                                    inputProps={{ style: { color: 'white' } }}
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                                />
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <TextField
                                    fullWidth
                                    label="Duration"
                                    placeholder="e.g. 5 days"
                                    value={med.duration}
                                    onChange={(e) => handleChange(index, 'duration', e.target.value)}
                                    InputLabelProps={{ style: { color: '#64748b' } }}
                                    inputProps={{ style: { color: 'white' } }}
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                                />
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}>
                                    <InputLabel style={{ color: '#64748b' }}>Route</InputLabel>
                                    <Select
                                        value={med.route}
                                        label="Route"
                                        onChange={(e) => handleChange(index, 'route', e.target.value)}
                                        sx={{ color: 'white' }}
                                    >
                                        <MenuItem value="Oral">Oral</MenuItem>
                                        <MenuItem value="IV">IV</MenuItem>
                                        <MenuItem value="IM">IM</MenuItem>
                                        <MenuItem value="Topical">Topical</MenuItem>
                                        <MenuItem value="Sublingual">Sublingual</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Special Instructions"
                                    placeholder="e.g. Take after meals"
                                    value={med.instructions}
                                    onChange={(e) => handleChange(index, 'instructions', e.target.value)}
                                    InputLabelProps={{ style: { color: '#64748b' } }}
                                    inputProps={{ style: { color: 'white' } }}
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                                />
                            </Grid>
                        </Grid>
                    </Box>
                ))}

                <Button
                    startIcon={<AddIcon />}
                    onClick={handleAddMedication}
                    sx={{ color: '#0d9488', fontWeight: 800, mb: 4, textTransform: 'none' }}
                >
                    Add Another Medication
                </Button>

                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button 
                        variant="outlined" 
                        onClick={() => navigate(-1)}
                        sx={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', px: 4, fontWeight: 800 }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={handleSubmit}
                        disabled={isSubmitting || !patientId}
                        sx={{ 
                            bgcolor: '#6366f1', 
                            '&:hover': { bgcolor: '#4f46e5' }, 
                            borderRadius: '12px', 
                            px: 5, 
                            fontWeight: 900,
                            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)'
                        }}
                    >
                        {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Finalize Prescription'}
                    </Button>
                </Box>
            </Card>

            <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast({ ...toast, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.type} sx={{ width: '100%', fontWeight: 'bold' }}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
