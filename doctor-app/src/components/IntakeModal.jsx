import React, { useState } from 'react';
import { Box, Typography, Button, TextField, Grid, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ApiService from '../utils/ApiService';

export default function IntakeModal({ open, onClose, patientId, onComplete }) {
    const [intakeConditions, setIntakeConditions] = useState('');
    const [intakeSymptoms, setIntakeSymptoms] = useState('');
    const [intakeVitalsBp, setIntakeVitalsBp] = useState('');
    const [intakeVitalsHr, setIntakeVitalsHr] = useState('');
    const [intakeMedications, setIntakeMedications] = useState([{ generic_name: '', dosage: '', frequency: 'daily' }]);
    const [intakeAllergies, setIntakeAllergies] = useState([{ allergen: '', severity: 'moderate' }]);
    const [intakeSubmitting, setIntakeSubmitting] = useState(false);

    const handleIntakeSubmit = async () => {
        setIntakeSubmitting(true);
        try {
            const conditions = intakeConditions.split(',')
                .map(c => c.trim())
                .filter(c => c.length > 0);

            const medications = intakeMedications.filter(m => m.generic_name.trim().length > 0);
            const allergies = intakeAllergies.filter(a => a.allergen.trim().length > 0);

            const payload = {
                conditions,
                medications,
                allergies,
                symptoms: intakeSymptoms,
                vitals_bp: intakeVitalsBp || "120/80",
                vitals_hr: intakeVitalsHr || "72",
                clinic_name: "Hospyn Clinic"
            };

            await ApiService.post(`/doctor/patient/${patientId}/intake`, payload);
            
            setIntakeConditions('');
            setIntakeSymptoms('');
            setIntakeVitalsBp('');
            setIntakeVitalsHr('');
            setIntakeMedications([{ generic_name: '', dosage: '', frequency: 'daily' }]);
            setIntakeAllergies([{ allergen: '', severity: 'moderate' }]);
            onComplete();
        } catch (error) {
            console.error("Error submitting intake:", error);
            alert("Network error or validation failed. Please try again.");
        } finally {
            setIntakeSubmitting(false);
        }
    };

    const addMedicationRow = () => {
        setIntakeMedications([...intakeMedications, { generic_name: '', dosage: '', frequency: 'daily' }]);
    };

    const removeMedicationRow = (index) => {
        const rows = [...intakeMedications];
        rows.splice(index, 1);
        setIntakeMedications(rows);
    };

    const handleMedicationChange = (index, field, value) => {
        const rows = [...intakeMedications];
        rows[index][field] = value;
        setIntakeMedications(rows);
    };

    const addAllergyRow = () => {
        setIntakeAllergies([...intakeAllergies, { allergen: '', severity: 'moderate' }]);
    };

    const removeAllergyRow = (index) => {
        const rows = [...intakeAllergies];
        rows.splice(index, 1);
        setIntakeAllergies(rows);
    };

    const handleAllergyChange = (index, field, value) => {
        const rows = [...intakeAllergies];
        rows[index][field] = value;
        setIntakeAllergies(rows);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '24px',
                    background: '#0a0f1d',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'white',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                    p: 1
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 2 }}>
                <SmartToyIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
                <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'Outfit', letterSpacing: 0.5 }}>
                    Baseline Health Intake Assessment
                </Typography>
            </DialogTitle>
            <DialogContent sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Typography variant="body2" sx={{ color: '#cbd5e1', lineHeight: 1.6 }}>
                    Please capture the patient's current clinical baseline. This data registers chronic conditions, home medications, allergies, and initial vitals. Chitti AI will immediately synthesize this info.
                </Typography>

                <Box>
                    <Typography variant="subtitle2" sx={{ color: '#f59e0b', fontWeight: 900, mb: 1.5, letterSpacing: 0.5 }}>INITIAL BASELINE VITALS</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Blood Pressure (mmHg)"
                                placeholder="e.g. 120/80"
                                value={intakeVitalsBp}
                                onChange={e => setIntakeVitalsBp(e.target.value)}
                                InputLabelProps={{ style: { color: '#cbd5e1' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Heart Rate (bpm)"
                                placeholder="e.g. 72"
                                value={intakeVitalsHr}
                                onChange={e => setIntakeVitalsHr(e.target.value)}
                                InputLabelProps={{ style: { color: '#cbd5e1' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                            />
                        </Grid>
                    </Grid>
                </Box>

                <Box>
                    <Typography variant="subtitle2" sx={{ color: '#f59e0b', fontWeight: 900, mb: 1.5, letterSpacing: 0.5 }}>CHRONIC CONDITIONS & DIAGNOSES</Typography>
                    <TextField
                        fullWidth
                        label="Active Diagnoses (Comma-separated)"
                        placeholder="e.g. Hypertension, Type II Diabetes, Asthma"
                        value={intakeConditions}
                        onChange={e => setIntakeConditions(e.target.value)}
                        InputLabelProps={{ style: { color: '#cbd5e1' } }}
                        inputProps={{ style: { color: 'white' } }}
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                    />
                </Box>

                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ color: '#f59e0b', fontWeight: 900, letterSpacing: 0.5 }}>ACTIVE HOME MEDICATIONS</Typography>
                        <Button size="small" onClick={addMedicationRow} sx={{ color: '#0d9488', fontWeight: 'bold' }}>+ Add Med</Button>
                    </Box>
                    {intakeMedications.map((med, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                            <TextField
                                label="Generic Name"
                                placeholder="e.g. Metformin"
                                value={med.generic_name}
                                onChange={e => handleMedicationChange(idx, 'generic_name', e.target.value)}
                                InputLabelProps={{ style: { color: '#cbd5e1' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ flex: 2, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                            />
                            <TextField
                                label="Dosage"
                                placeholder="e.g. 500mg"
                                value={med.dosage}
                                onChange={e => handleMedicationChange(idx, 'dosage', e.target.value)}
                                InputLabelProps={{ style: { color: '#cbd5e1' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                            />
                            <TextField
                                label="Frequency"
                                placeholder="e.g. Daily"
                                value={med.frequency}
                                onChange={e => handleMedicationChange(idx, 'frequency', e.target.value)}
                                InputLabelProps={{ style: { color: '#cbd5e1' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                            />
                            {intakeMedications.length > 1 && (
                                <Button sx={{ color: '#ef4444', minWidth: 40 }} onClick={() => removeMedicationRow(idx)}>Remove</Button>
                            )}
                        </Box>
                    ))}
                </Box>

                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ color: '#f59e0b', fontWeight: 900, letterSpacing: 0.5 }}>KNOWN ALLERGIES & CONTRAINDICATIONS</Typography>
                        <Button size="small" onClick={addAllergyRow} sx={{ color: '#0d9488', fontWeight: 'bold' }}>+ Add Allergy</Button>
                    </Box>
                    {intakeAllergies.map((alg, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                            <TextField
                                label="Allergen"
                                placeholder="e.g. Penicillin"
                                value={alg.allergen}
                                onChange={e => handleAllergyChange(idx, 'allergen', e.target.value)}
                                InputLabelProps={{ style: { color: '#cbd5e1' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ flex: 2, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                            />
                            <TextField
                                label="Severity"
                                placeholder="e.g. Severe / Moderate"
                                value={alg.severity}
                                onChange={e => handleAllergyChange(idx, 'severity', e.target.value)}
                                InputLabelProps={{ style: { color: '#cbd5e1' } }}
                                inputProps={{ style: { color: 'white' } }}
                                sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                            />
                            {intakeAllergies.length > 1 && (
                                <Button sx={{ color: '#ef4444', minWidth: 40 }} onClick={() => removeAllergyRow(idx)}>Remove</Button>
                            )}
                        </Box>
                    ))}
                </Box>

                <Box>
                    <Typography variant="subtitle2" sx={{ color: '#f59e0b', fontWeight: 900, mb: 1.5, letterSpacing: 0.5 }}>INITIAL ENCOUNTER NOTES</Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Primary Symptoms & Intake Memo"
                        placeholder="Describe primary concerns and observations..."
                        value={intakeSymptoms}
                        onChange={e => setIntakeSymptoms(e.target.value)}
                        InputLabelProps={{ style: { color: '#cbd5e1' } }}
                        inputProps={{ style: { color: 'white' } }}
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' } } }}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.05)', gap: 1.5 }}>
                <Button onClick={onClose} sx={{ color: '#cbd5e1', fontWeight: 'bold' }}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={intakeSubmitting}
                    onClick={handleIntakeSubmit}
                    sx={{
                        background: 'linear-gradient(45deg, #0d9488 0%, #0f766e 100%)',
                        color: 'white',
                        px: 4,
                        py: 1.5,
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 8px 20px rgba(13, 148, 136, 0.3)',
                        '&:hover': { background: 'linear-gradient(45deg, #0f766e 0%, #115e59 100%)' }
                    }}
                >
                    {intakeSubmitting ? 'Recording Intake...' : 'Submit Baseline Record'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
