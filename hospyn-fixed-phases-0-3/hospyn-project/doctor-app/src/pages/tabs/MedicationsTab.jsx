import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, Button } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function MedicationsTab() {
    const medications = [
        { name: "Metformin Hydrochloride", dosage: "500 mg", frequency: "2x daily", duration: "Ongoing (since Oct 2021)", doctor: "Dr. Gregory House" },
        { name: "Atorvastatin Calcium", dosage: "20 mg", frequency: "1x at night", duration: "Ongoing (since Jan 2022)", doctor: "Dr. Gregory House" },
        { name: "Loratadine", dosage: "10 mg", frequency: "As needed", duration: "Seasonal", doctor: "Dr. Lisa Cuddy" },
    ];

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

            {/* AI Flags */}
            <Alert
                severity="warning"
                icon={<WarningAmberIcon />}
                sx={{ mb: 4 }}
            >
                <strong>AI Interaction Flag:</strong> Based on the patient's reported allergies, ensure no cross-reactivity with new prescriptions. No active drug-drug conflicts detected in the current list.
            </Alert>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">Active Prescriptions</Typography>
                <Button variant="contained" color="secondary" size="small">Add New Prescription</Button>
            </Box>

            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <Table sx={{ minWidth: 650 }}>
                    <TableHead sx={{ bgcolor: '#f4f6f8' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Drug Name</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Dosage</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Frequency</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Duration</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Prescribing Doctor</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {medications.map((row) => (
                            <TableRow key={row.name} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                <TableCell component="th" scope="row">
                                    <Typography fontWeight="bold">{row.name}</Typography>
                                </TableCell>
                                <TableCell>{row.dosage}</TableCell>
                                <TableCell>{row.frequency}</TableCell>
                                <TableCell>
                                    <Chip label={row.duration} size="small" variant={row.duration.includes('Ongoing') ? 'filled' : 'outlined'} color={row.duration.includes('Ongoing') ? 'primary' : 'default'} />
                                </TableCell>
                                <TableCell color="text.secondary">{row.doctor}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

        </Box>
    );
}
