import React, { useState } from 'react';
import { Dialog, DialogContent, Box, Typography, Button, IconButton, TextField, Checkbox, FormControlLabel, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import CloseIcon from '@mui/icons-material/Close';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ConstructionIcon from '@mui/icons-material/Construction';
import { useSocket } from '../contexts/SocketContext';

// FIXED: this entire flow called endpoints and listened for WebSocket
// events that don't exist anywhere on the backend:
//   - POST /doctor/scan-patient — not defined in any backend router.
//   - WS message types "access_granted" / "access_revoked" — never sent
//     by any backend code; a doctor reaching step 3 ("Waiting for Patient
//     Approval") would wait forever with no way for that approval to ever
//     arrive.
//   - The manual-ID lookup also sent a human-readable Hospain ID
//     ("Hospain-IN-XXXX-XXXX-XX") to GET /doctor/patient/{walkin_id},
//     whose {walkin_id} path param is UUID-typed on the backend — that
//     request would 422 before ever reaching real lookup logic.
// Rather than ship a flow that silently 404s or hangs indefinitely on a
// feature with zero backend support, this is disabled with a clear
// message. The UI shell (steps, consent checklist, WS listener) is left
// in place so this can be wired up once a real consent-request endpoint
// and matching WS events exist server-side.
export default function ScanModal({ open, onClose }) {
    const navigate = useNavigate();

    const handleClose = () => {
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, pb: 1 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ color: '#1f2937' }}>
                    Scan Patient QR
                </Typography>
                <IconButton onClick={handleClose}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: 3, pt: 1 }}>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <ConstructionIcon sx={{ fontSize: 56, color: '#9ca3af', mb: 2 }} />
                    <Typography variant="h6" fontWeight="bold" sx={{ color: '#111827', mb: 1 }}>
                        Not available yet
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', maxWidth: 380, mx: 'auto' }}>
                        Patient QR scan-and-consent access isn't connected to a backend service yet.
                        Use the patient search or your active queue to open a patient's record instead.
                    </Typography>
                    <Button
                        variant="outlined"
                        sx={{ mt: 3, color: '#0d9488', borderColor: '#0d9488' }}
                        onClick={() => { handleClose(); navigate('/patients'); }}
                    >
                        Go to Patient Search
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
