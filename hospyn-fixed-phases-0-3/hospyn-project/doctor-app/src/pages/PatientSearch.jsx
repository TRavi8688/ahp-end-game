import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert, Divider } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';

export default function PatientSearch() {
    const [searchId, setSearchId] = useState('');
    const [error, setError] = useState(false);
    const navigate = useNavigate();

    const handleSearch = () => {
        if (searchId.trim().length < 5) {
            setError(true);
            return;
        }
        setError(false);
        // Mock navigating to found patient
        navigate(`/patient/${searchId.trim()}`);
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
            <Typography variant="h4" fontWeight="bold" mb={1}>Access Patient Records</Typography>
            <Typography variant="body1" color="text.secondary" mb={4}>
                Enter a patient's Health ID or scan their secure QR code to instantly access their AI-summarized medical history.
            </Typography>

            <Paper elevation={0} sx={{ p: 4, border: 1, borderColor: 'divider', borderRadius: 2 }}>

                {/* Search by ID Block */}
                <Typography variant="h6" fontWeight="bold" mb={2}>Enter Health ID (Hospyn ID)</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="e.g. hospyn-1234-abcd"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        error={error}
                        helperText={error ? "Please enter a valid Health ID" : ""}
                    />
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<SearchIcon />}
                        onClick={handleSearch}
                        sx={{ px: 4, whiteSpace: 'nowrap', height: 56 }}
                    >
                        Access Record
                    </Button>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', my: 4 }}>
                    <Divider sx={{ flexGrow: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mx: 2 }}>OR</Typography>
                    <Divider sx={{ flexGrow: 1 }} />
                </Box>

                {/* Scan QR Block */}
                <Box sx={{ textAlign: 'center' }}>
                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<QrCodeScannerIcon />}
                        sx={{ py: 2, px: 6, borderRadius: 2 }}
                    >
                        Scan Patient QR Code
                    </Button>
                    <Typography variant="caption" display="block" color="text.secondary" mt={2}>
                        Patient must open their Hospyn App and present the dynamic QR code for scanning.
                    </Typography>
                </Box>

            </Paper>

            {/* Info Alert */}
            <Alert severity="info" sx={{ mt: 4 }}>
                <strong>Note on Access:</strong> Time-limited access links will automatically expire based on the patient's privacy settings. Ensure you review critical flags immediately upon access.
            </Alert>

        </Box>
    );
}
