import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, Grid, Card, IconButton, Autocomplete, MenuItem, Divider, Chip, Snackbar, Alert, CircularProgress } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../api';

// Icons
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import SendIcon from '@mui/icons-material/Send';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MedicationIcon from '@mui/icons-material/Medication';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';

export default function Prescriptions() {
    const location = useLocation();
    const preSelectedPatient = location.state?.patient || null;

    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient);
    const [diagnosis, setDiagnosis] = useState('');
    const [notes, setNotes] = useState('');
    const [medications, setMedications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/doctor/my-patients`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setPatients(data);
                    if (data.length > 0 && !preSelectedPatient) {
                        setSelectedPatient(data[0]);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch patients", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPatients();
    }, []);

    // New Medicine Form
    const [showNewMed, setShowNewMed] = useState(false);
    const [newMedName, setNewMedName] = useState('');
    const [newMedDose, setNewMedDose] = useState('');

    // AI Checking State
    const [isChecking, setIsChecking] = useState(false);
    const [conflict, setConflict] = useState(null);

    const [toastOpen, setToastOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const startVoiceToNote = (field) => {
        setIsListening(true);
        setTimeout(() => setIsListening(false), 2000);
    };

    // Mock drug database for autocomplete
    const DRUG_DB = ['Amoxicillin', 'Amlodipine', 'Metformin', 'Salbutamol', 'Atorvastatin', 'Paracetamol', 'Ibuprofen', 'Levothyroxine'];

    // AI Drug Interaction Check
    const runAICheck = async (medName) => {
        if (!selectedPatient) return;
        setIsChecking(true);
        setConflict(null);

        // Mock check logic
        setTimeout(() => {
            setConflict({
                status: 'passed',
                message: `✓ Allergy check passed. No conflicts detected.`
            });
            setIsChecking(false);
        }, 1200);
    };

    const handleAddMedication = () => {
        if (!newMedName) return;
        setMedications([...medications, { name: newMedName, dose: newMedDose || 'As directed', frequency: 'OD', route: 'Oral' }]);
        setShowNewMed(false);
        runAICheck(newMedName);
        setNewMedName('');
        setNewMedDose('');
    };

    const handleRemoveMed = (index) => {
        const newMeds = [...medications];
        newMeds.splice(index, 1);
        setMedications(newMeds);
        setConflict(null); // reset check when meds change
    };

    const [forensicSeal, setForensicSeal] = useState(null);

    const handleSend = async () => {
        if (!selectedPatient || medications.length === 0) return;

        setIsSending(true);
        try {
            const response = await fetch(`${API_BASE_URL}/clinical/prescribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    patient_id: selectedPatient.id,
                    visit_id: location.state?.visitId || null,
                    diagnosis: diagnosis,
                    medications: medications.map(m => ({
                        name: m.name,
                        dosage: m.dose,
                        frequency: m.frequency,
                        duration: 'As directed',
                        instructions: notes
                    })),
                    notes: notes
                })
            });

            if (response.ok) {
                const data = await response.json();
                setForensicSeal(data.signature_hash);
                setToastOpen(true);
                // Reset form
                setMedications([]);
                setDiagnosis('');
                setNotes('');
                setConflict(null);
            } else {
                console.error("Failed to send prescription");
            }
        } catch (error) {
            console.error("Error sending prescription:", error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', background: 'transparent' }}>

            {/* Header Cluster */}
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Outfit', letterSpacing: '-1.5px', mb: 1 }}>Clinical Issuance</Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600, letterSpacing: 0.5 }}>SECURE Hospyn PRESCRIPTION PROTOCOL</Typography>
                </Box>
            </Box>

            <Grid container spacing={5}>

                {/* Left Column - Issuance Terminal */}
                <Grid item xs={12} md={7.5}>
                    <Card className="glass-card" elevation={0} sx={{ 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        borderRadius: '32px', 
                        p: 6, 
                        bgcolor: 'rgba(255,255,255,0.02)',
                        backdropFilter: 'blur(40px)',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                    }}>

                        {/* Subject Selection */}
                        <Box sx={{ mb: 6 }}>
                            <Typography variant="overline" sx={{ color: '#475569', fontWeight: 900, mb: 2, display: 'block', letterSpacing: 1.5 }}>TARGET SUBJECT</Typography>
                            <Autocomplete
                                options={patients}
                                getOptionLabel={(option) => `${option.name} [${option.hospyn_id}]`}
                                value={selectedPatient}
                                disabled={!!preSelectedPatient}
                                onChange={(e, v) => { setSelectedPatient(v); setConflict(null); }}
                                renderInput={(params) => (
                                    <TextField 
                                        {...params} 
                                        placeholder={preSelectedPatient ? "" : "Identify Patient..."} 
                                        sx={{ 
                                            '& .MuiOutlinedInput-root': { 
                                                color: '#fff', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px', 
                                                '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' },
                                                '&:hover fieldset': { borderColor: '#0d9488' }
                                            }
                                        }}
                                    />
                                )}
                                sx={{ mb: 4 }}
                            />

                            <Typography variant="overline" sx={{ color: '#475569', fontWeight: 900, mb: 1.5, display: 'block', letterSpacing: 1.5 }}>CLINICAL INDICATION</Typography>
                            <TextField
                                fullWidth
                                placeholder="Primary diagnosis or therapeutic reason..."
                                value={diagnosis}
                                onChange={(e) => setDiagnosis(e.target.value)}
                                sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                        color: '#fff', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' }
                                    }
                                }}
                            />
                        </Box>

                        {/* Therapeutic Cluster */}
                        <Box sx={{ mb: 6 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontFamily: 'Outfit' }}>Therapeutic Regime</Typography>
                            </Box>

                            <Box sx={{ border: '1px solid rgba(255,255,255,0.03)', borderRadius: '24px', overflow: 'hidden', mb: 4, bgcolor: 'rgba(0,0,0,0.2)' }}>
                                {medications.length > 0 ? medications.map((med, i) => (
                                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', p: 3, borderBottom: i < medications.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}>
                                        <Box sx={{ p: 1.2, bgcolor: 'rgba(13, 148, 136, 0.1)', borderRadius: '12px', mr: 2.5 }}>
                                            <MedicationIcon sx={{ color: '#0d9488', fontSize: 20 }} />
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#fff', mb: 0.5 }}>{med.name.toUpperCase()}</Typography>
                                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
                                                {med.dose} ∙ {med.frequency} ∙ {med.route.toUpperCase()}
                                            </Typography>
                                        </Box>
                                        <IconButton size="small" sx={{ color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.05)', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }} onClick={() => handleRemoveMed(i)}>
                                            <DeleteOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                )) : (
                                    <Box sx={{ p: 6, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.01)' }}>
                                        <Typography variant="body2" sx={{ color: '#334155', fontWeight: 800, letterSpacing: 1 }}>AWAITING THERAPEUTIC INPUT</Typography>
                                    </Box>
                                )}
                            </Box>

                            {/* MULAJNA AI Verification */}
                            {(isChecking || conflict) && (
                                <Box sx={{ 
                                    display: 'flex', alignItems: 'center', p: 3, borderRadius: '20px', mb: 4,
                                    bgcolor: isChecking ? 'rgba(99, 102, 241, 0.05)' : conflict.status === 'failed' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(13, 148, 136, 0.05)',
                                    border: `1px solid ${isChecking ? 'rgba(99, 102, 241, 0.1)' : conflict.status === 'failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(13, 148, 136, 0.15)'}`,
                                    boxShadow: isChecking ? '0 0 20px rgba(99, 102, 241, 0.05)' : 'none'
                                }}>
                                    {isChecking ? (
                                        <CircularProgress size={16} sx={{ color: '#6366f1', mr: 2 }} />
                                    ) : conflict.status === 'failed' ? (
                                        <WarningAmberIcon sx={{ color: '#ef4444', mr: 2 }} />
                                    ) : (
                                        <CheckCircleIcon sx={{ color: '#0d9488', mr: 2 }} />
                                    )}
                                    <Typography variant="body2" sx={{ fontWeight: 900, color: isChecking ? '#6366f1' : conflict.status === 'failed' ? '#f87171' : '#2dd4bf', letterSpacing: 0.5 }}>
                                        {isChecking ? "CORE AI ANALYZING INTERACTIONS..." : conflict.status === 'failed' ? `CRITICAL: ${conflict.warning}` : "MULAJNA CLEARANCE: NO ADVERSE SIGNALS"}
                                    </Typography>
                                </Box>
                            )}

                            {/* Med Injection Field */}
                            {showNewMed ? (
                                <Box sx={{ p: 3, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.01)' }}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <Autocomplete
                                                freeSolo
                                                options={DRUG_DB}
                                                value={newMedName}
                                                onInputChange={(e, v) => setNewMedName(v)}
                                                renderInput={(params) => (
                                                    <TextField 
                                                        {...params} 
                                                        label="Drug Name" 
                                                        size="small" 
                                                        autoFocus 
                                                        sx={{ 
                                                            '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px' },
                                                            '& .MuiInputLabel-root': { color: '#64748b' }
                                                        }}
                                                    />
                                                )}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField 
                                                fullWidth 
                                                label="Dose (e.g. 10mg BID)" 
                                                size="small" 
                                                value={newMedDose} 
                                                onChange={(e) => setNewMedDose(e.target.value)} 
                                                sx={{ 
                                                    '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '12px' },
                                                    '& .MuiInputLabel-root': { color: '#64748b' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 1 }}>
                                                <Button sx={{ color: '#64748b', fontWeight: 700 }} onClick={() => setShowNewMed(false)}>Dismiss</Button>
                                                <Button variant="contained" sx={{ bgcolor: '#0d9488', borderRadius: '12px', fontWeight: 900, px: 3 }} onClick={handleAddMedication}>Inject</Button>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </Box>
                            ) : (
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    startIcon={<AddCircleOutlinedIcon />}
                                    onClick={() => setShowNewMed(true)}
                                    sx={{ 
                                        color: '#0d9488', 
                                        borderColor: 'rgba(13, 148, 136, 0.3)', 
                                        borderStyle: 'dashed', 
                                        borderRadius: '20px',
                                        py: 2,
                                        '&:hover': { bgcolor: 'rgba(13, 148, 136, 0.05)', borderColor: '#0d9488' }, 
                                        textTransform: 'none', 
                                        fontWeight: 800 
                                    }}
                                >
                                    Append Medication
                                </Button>
                            )}
                        </Box>

                        {/* Practitioner Commentary */}
                        <Box sx={{ mb: 6 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Typography variant="overline" sx={{ color: '#475569', fontWeight: 900, flex: 1, letterSpacing: 1.5 }}>PRACTITIONER OVERRIDE / NOTES</Typography>
                                <IconButton sx={{ bgcolor: isListening ? '#ef4444' : 'rgba(255,255,255,0.03)', color: isListening ? '#fff' : '#6366f1' }} onClick={() => startVoiceToNote('notes')}>
                                    {isListening ? <MicOffIcon size="small" /> : <MicIcon size="small" />}
                                </IconButton>
                            </Box>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                placeholder="Clinical context, lifestyle guidance, or specific warnings for the patient vault..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                        color: '#fff', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '20px',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.05)' }
                                    }
                                }}
                            />
                        </Box>

                        {/* Finalization Hub */}
                        <Box sx={{ display: 'flex', gap: 3 }}>
                            <Button
                                variant="contained"
                                size="large"
                                endIcon={<SendIcon />}
                                disabled={medications.length === 0 || isSending}
                                onClick={handleSend}
                                sx={{ 
                                    flex: 2, 
                                    bgcolor: '#0d9488', 
                                    boxShadow: '0 8px 25px rgba(13, 148, 136, 0.3)',
                                    '&:hover': { bgcolor: '#0f766e', transform: 'translateY(-2px)' }, 
                                    fontWeight: 900,
                                    borderRadius: '18px',
                                    py: 2.5,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isSending ? "ENCRYPTING & DISPATCHING..." : "COMMIT TO Hospyn LEDGER"}
                            </Button>
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<PictureAsPdfIcon />}
                                sx={{ 
                                    flex: 1, 
                                    color: '#fff', 
                                    borderColor: 'rgba(255,255,255,0.1)', 
                                    fontWeight: 700, 
                                    borderRadius: '18px',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.2)' } 
                                }}
                            >
                                ARCHIVE PDF
                            </Button>
                        </Box>

                    </Card>
                </Grid>

                {/* Right Column - Audit Log */}
                <Grid item xs={12} md={4.5}>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 4, fontFamily: 'Outfit', letterSpacing: 1 }}>RECENT ISSUANCES</Typography>

                    <Box sx={{ position: 'relative', pl: 4, borderLeft: '1px solid rgba(255,255,255,0.1)', ml: 1 }}>
                        <Box sx={{ py: 6, textAlign: 'center' }}>
                            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.01)', borderRadius: '50%', display: 'inline-block', mb: 2 }}>
                                <MedicationIcon sx={{ color: '#334155', fontSize: 40 }} />
                            </Box>
                            <Typography sx={{ color: '#64748b', fontWeight: 700, letterSpacing: 1, fontSize: '0.8rem' }}>NODE HISTORY EMPTY</Typography>
                        </Box>
                    </Box>
                </Grid>

            </Grid>

            <Snackbar open={toastOpen} autoHideDuration={3000} onClose={() => setToastOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setToastOpen(false)} severity="success" sx={{ 
                    width: '100%', bgcolor: '#0d9488', color: '#fff', borderRadius: '16px', fontWeight: 900,
                    '& .MuiAlert-icon': { color: '#fff' }
                }}>
                    TRANSACTION CONFIRMED: PRESCRIPTION LEDGER UPDATED.
                    {forensicSeal && <Box sx={{ mt: 1, fontSize: '0.65rem', opacity: 0.8, fontFamily: 'monospace' }}>SEAL: {forensicSeal}</Box>}
                </Alert>
            </Snackbar>

        </Box>
    );
}

const TimelineEntry = ({ status, title, desc, date }) => {
    const getColor = (s) => {
        if (s === 'teal') return '#0d9488';
        if (s === 'amber') return '#f59e0b';
        if (s === 'red') return '#ef4444';
        return '#64748b';
    };

    return (
        <Box sx={{ mb: 5, position: 'relative' }}>
            <Box sx={{
                position: 'absolute', left: -37, top: 4, width: 14, height: 14, borderRadius: '50%',
                bgcolor: getColor(status),
                boxShadow: `0 0 10px ${getColor(status)}`,
                border: '2px solid #050810'
            }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#fff', mb: 0.5, fontFamily: 'Outfit' }}>{title.toUpperCase()}</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 1, fontWeight: 500 }}>{desc}</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: getColor(status), fontWeight: 900 }}>{date.toUpperCase()}</Typography>
        </Box>
    );
};
