import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert, Divider, CircularProgress } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

export default function PatientSearch() {
    const [searchId, setSearchId] = useState('');
    const [error, setError] = useState('');
    const [searching, setSearching] = useState(false);
    const navigate = useNavigate();

    // FIXED: this used to do `navigate(`/patient/${searchId}`)` directly
    // on whatever text was typed — literally commented "Mock navigating to
    // found patient" — which would always 422 against the real
    // walk-in-typed /patient/{walkin_id} route regardless of what was
    // entered. Now does a real lookup against the new
    // GET /doctor/patient-record/lookup endpoint, then navigates using the
    // resolved Patient.id against the matching by-ID chart view.
    const handleSearch = async () => {
        const trimmed = searchId.trim();
        if (trimmed.length < 5) {
            setError('Please enter a valid Health ID');
            return;
        }
        setError('');
        setSearching(true);
        try {
            const result = await apiClient.get('/doctor/patient-record/lookup', {
                params: { hospyn_id: trimmed },
            });
            const patientId = result?.data?.patient_id || result?.patient_id;
            if (!patientId) {
                setError('No patient found with that Health ID.');
                return;
            }
            navigate(`/patient-record/${patientId}`);
        } catch (err) {
            setError(err.message || 'No patient found with that Health ID.');
        } finally {
            setSearching(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
            <Typography variant="h4" fontWeight="bold" mb={1}>Access Patient Records</Typography>
            <Typography variant="body1" color="text.secondary" mb={4}>
                Enter a patient's Health ID to access their medical history.
            </Typography>

            <Paper elevation={0} sx={{ p: 4, border: 1, borderColor: 'divider', borderRadius: 2 }}>

                {/* Search by ID Block */}
                <Typography variant="h6" fontWeight="bold" mb={2}>Enter Health ID (Hospain ID)</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="e.g. HOSPYN-123456-ABC"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        error={Boolean(error)}
                        helperText={error}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={searching ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                        onClick={handleSearch}
                        disabled={searching}
                        sx={{ px: 4, whiteSpace: 'nowrap', height: 56 }}
                    >
                        {searching ? 'Searching...' : 'Access Record'}
                    </Button>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', my: 4 }}>
                    <Divider sx={{ flexGrow: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mx: 2 }}>OR</Typography>
                    <Divider sx={{ flexGrow: 1 }} />
                </Box>

                {/* Scan QR Block */}
                {/* NOTE: QR scanning isn't wired to anything real yet — see
                    ScanModal.jsx for the same situation and why it's
                    disabled there. Disabled here for the same reason
                    rather than left clickable with no effect. */}
                <Box sx={{ textAlign: 'center' }}>
                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<QrCodeScannerIcon />}
                        disabled
                        sx={{ py: 2, px: 6, borderRadius: 2 }}
                    >
                        Scan Patient QR Code (coming soon)
                    </Button>
                    <Typography variant="caption" display="block" color="text.secondary" mt={2}>
                        Patient must open their Hospain App and present the dynamic QR code for scanning.
                    </Typography>
                </Box>

            </Paper>

            {/* Info Alert */}
            <Alert severity="info" sx={{ mt: 4 }}>
                You can look up any patient registered at your hospital, even if they aren't checked in
                today. Writing notes or prescriptions for a visit still requires the patient to check in.
            </Alert>

        </Box>
    );
}
