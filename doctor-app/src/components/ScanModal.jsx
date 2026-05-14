import React, { useState } from 'react';
import { Dialog, DialogContent, Box, Typography, Button, IconButton, TextField, Checkbox, FormControlLabel, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import CloseIcon from '@mui/icons-material/Close';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useSocket } from '../contexts/SocketContext';
import { API_BASE_URL } from '../api';

// Mock Patient lookup for demo
const DEMO_PATIENTS = {
    'Hospyn-IN-9284-7731': { name: 'Rahul Sharma', allergies: ['Penicillin (Severe)', 'Sulfa drugs (Severe)'] },
    'Hospyn-IN-3312-9801': { name: 'Ananya Mehta', allergies: ['Latex (Severe)'] },
    'Hospyn-IN-5521-4413': { name: 'Vijay Kumar', allergies: [] }
};

export default function ScanModal({ open, onClose }) {
    const navigate = useNavigate();
    const { lastMessage } = useSocket();
    const [step, setStep] = useState(1); // 1 = Scan/Entry, 2 = Verification, 3 = Pending Approval
    const [manualId, setManualId] = useState('');
    const [isScanning, setIsScanning] = useState(false);

    // Step 2 & 3 State
    const [patientData, setPatientData] = useState(null);
    const [consent1, setConsent1] = useState(false);
    const [consent2, setConsent2] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [accessId, setAccessId] = useState(null);

    // Listen for WebSocket Approval
    React.useEffect(() => {
        if (lastMessage && lastMessage.type === 'access_granted' && step === 3) {
            handleClose();
            navigate(`/patient/${patientData.id}`);
        }
    }, [lastMessage, step]);

    const handleClose = () => {
        setStep(1);
        setManualId('');
        setIsScanning(false);
        setPatientData(null);
        setConsent1(false);
        setConsent2(false);
        setErrorMsg('');
        onClose();
    };

    const handleLookup = async () => {
        setIsScanning(true);
        try {
            // First, just check if the patient exists and get basic info
            // In a real app we might have a specific 'lookup' endpoint that return only public profile
            // For now we use the clinical view if permitted, or handle 404/403
            const response = await fetch(`${API_BASE_URL}/doctor/patient/${manualId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setPatientData({
                    name: data.profile?.name || "Hospyn Patient",
                    id: data.profile?.hospyn_id || manualId,
                    allergies: (data.allergies || []).map(a => `${a.allergen} (${a.severity})`)
                });
                setStep(2);
            } else if (response.status === 202) {
                // Access is pending
                setPatientData({ name: "Hospyn Patient", id: manualId, allergies: [] });
                setStep(3);
            } else if (response.status === 403) {
                setErrorMsg("Access denied. Please request access for this patient.");
                setPatientData({ name: "Hospyn Patient", id: manualId, allergies: [] });
                setStep(2);
            } else {
                alert("Patient not found or connection error. Please check the Hospyn ID.");
            }
        } catch (error) {
            console.error("Lookup error:", error);
            alert("Connection error. Please try again.");
        } finally {
            setIsScanning(false);
        }
    };

    const handleConfirmAccess = async () => {
        setIsScanning(true);
        try {
            const response = await fetch(`${API_BASE_URL}/doctor/scan-patient`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    hospyn_id: patientData.id,
                    clinic_name: "Hospyn Clinic",
                    access_level: "full"
                })
            });

            const result = await response.json();

            if (response.ok) {
                if (result.status === 'pending') {
                    setAccessId(result.access_id);
                    setStep(3); // Move to Waiting State
                } else if (result.status === 'success') {
                    handleClose();
                    navigate(`/patient/${patientData.id}`);
                }
            } else {
                alert(result.detail || "Failed to grant access. Please try again.");
            }
        } catch (error) {
            console.error("Confirm error:", error);
            alert("Network error. Please try again.");
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, pb: 1 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937' }}>
                    {step === 1 ? 'Scan Patient QR' : 'Verify Patient Consent'}
                </Typography>
                <IconButton onClick={handleClose}>
                    <CloseIcon />
                </IconButton>
            </Box>

            {errorMsg && (
                <Box sx={{ px: 3, pb: 2 }}>
                    <Alert severity="warning" onClose={() => setErrorMsg('')} sx={{ borderRadius: 2 }}>
                        {errorMsg}
                    </Alert>
                </Box>
            )}

            <DialogContent sx={{ p: 3, pt: 1 }}>

                {step === 1 && (
                    <Box sx={{ textAlign: 'center' }}>
                        {/* Simulation of Camera View */}
                        <Box sx={{
                            width: '100%', height: 280, bgcolor: '#000', borderRadius: 2, mb: 3,
                            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden'
                        }}>
                            {!isScanning && (
                                <Box sx={{
                                    width: 200, height: 200, border: '2px solid rgba(255,255,255,0.4)', borderRadius: 2,
                                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
                                }}>
                                    <Box sx={{ width: '100%', height: 4, bgcolor: '#0d9488', position: 'absolute', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, boxShadow: '0 0 10px #0d9488' }} />
                                </Box>
                            )}
                            {isScanning && <CircularProgress sx={{ color: '#0d9488' }} />}
                        </Box>

                        <Typography variant="body2" sx={{ color: '#6b7280', mb: 3 }}>
                            Ask the patient to open their Hospyn App and display their connection QR code.
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Box sx={{ flex: 1, height: '1px', bgcolor: '#e5e7eb' }} />
                            <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 'bold' }}>OR ENTER MANUALLY</Typography>
                            <Box sx={{ flex: 1, height: '1px', bgcolor: '#e5e7eb' }} />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Hospyn-IN-XXXX-XXXX-XX"
                                value={manualId}
                                onChange={(e) => setManualId(e.target.value)}
                            />
                            <Button variant="contained" sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' } }} onClick={handleLookup}>
                                Lookup
                            </Button>
                        </Box>
                    </Box>
                )}

                {step === 2 && patientData && (
                    <Box>
                        {/* Confirmation Header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, p: 2, bgcolor: '#f0fdfa', borderRadius: 2, border: '1px solid #ccfbf1' }}>
                            <HealthAndSafetyIcon sx={{ color: '#0d9488', fontSize: 40 }} />
                            <Box>
                                <Typography variant="h6" fontWeight="bold" sx={{ color: '#111827' }}>{patientData.name}</Typography>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#0f766e', fontWeight: 'bold' }}>{patientData.id}</Typography>
                            </Box>
                        </Box>

                        {/* Critical Allergies Pre-alert */}
                        {patientData.allergies.length > 0 && (
                            <Box sx={{ p: 2, bgcolor: '#fee2e2', borderRadius: 2, mb: 3, border: '1px solid #fca5a5' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <WarningAmberIcon sx={{ color: '#dc2626' }} />
                                    <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#b91c1c' }}>CRITICAL ALLERGY ALERT</Typography>
                                </Box>
                                <Typography variant="body2" sx={{ color: '#991b1b', mb: 1 }}>
                                    This patient has severe allergies recorded. You must review these before prescribing.
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {patientData.allergies.map((a, idx) => <Box key={`${a}-${idx}`} sx={{ bgcolor: '#7f1d1d', color: 'white', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 'bold' }}>{a}</Box>)}
                                </Box>
                            </Box>
                        )}

                        {/* Consent Checkboxes */}
                        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: '#374151', mb: 1 }}>
                                Legal Requirements
                            </Typography>
                            <FormControlLabel
                                control={<Checkbox checked={consent1} onChange={e => setConsent1(e.target.checked)} sx={{ color: '#0d9488', '&.Mui-checked': { color: '#0d9488' } }} />}
                                label={<Typography variant="body2" sx={{ color: '#4b5563' }}>I have the patient's explicit consent to access their medical records.</Typography>}
                            />
                            <FormControlLabel
                                control={<Checkbox checked={consent2} onChange={e => setConsent2(e.target.checked)} sx={{ color: '#0d9488', '&.Mui-checked': { color: '#0d9488' } }} />}
                                label={<Typography variant="body2" sx={{ color: '#4b5563' }}>I understand that this access and any actions taken are permanently logged in the patient's Hospyn app.</Typography>}
                            />
                        </Box>

                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={!consent1 || !consent2}
                            onClick={handleConfirmAccess}
                            sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' }, py: 1.5, fontWeight: 'bold' }}
                        >
                            Confirm & Access Records
                        </Button>
                    </Box>
                )}

                {step === 3 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
                            <CircularProgress size={80} thickness={2} sx={{ color: '#0d9488' }} />
                            <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <HourglassEmptyIcon sx={{ color: '#0d9488', fontSize: 30 }} />
                            </Box>
                        </Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>Waiting for Patient Approval</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, px: 2 }}>
                            A request has been sent to <strong>{patientData?.name}</strong>.
                            Please ask the patient to click <strong>"Approve"</strong> on their Hospyn App notification.
                        </Typography>

                        <Box sx={{ p: 2, bgcolor: '#f0fdfa', borderRadius: 2, border: '1px dashed #0d9488', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <CheckCircleIcon sx={{ color: '#0d9488' }} />
                            <Typography variant="caption" sx={{ color: '#0f766e', textAlign: 'left' }}>
                                This screen will automatically refresh once the patient grants access.
                            </Typography>
                        </Box>
                    </Box>
                )}

            </DialogContent>
        </Dialog>
    );
}
