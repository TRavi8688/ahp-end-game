import React from 'react';
import { Box, Typography, Card, CardContent, Divider, Chip, Grid, Alert } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

export default function ClinicalSummaryTab() {
    // Mock AI summary data
    const summary = {
        overview: "Patient presents with a history of Type 2 Diabetes diagnosed in 2021. Recent HbA1c is borderline at 6.8%. Patient is currently managed with Metformin and Atorvastatin. Reports occasional shortness of breath which warrants further investigation.",
        keyDiagnoses: [
            { condition: "Type 2 Diabetes Mellitus", date: "Oct 2021" },
            { condition: "Hyperlipidemia", date: "Jan 2022" },
            { condition: "Mild Allergic Rhinitis", date: "Mar 2018" }
        ],
        recentHighlights: [
            "HbA1c tested on 12 Oct 2024: 6.8% (Borderline/Target)",
            "Lipid panel on 15 Aug 2024: LDL 98 mg/dL (Controlled)",
            "Ophthalmology screening on 01 Jun 2024: Mild background retinopathy detected."
        ]
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

            <Alert
                icon={<AutoAwesomeIcon />}
                severity="info"
                sx={{ mb: 4, bgcolor: '#e3f2fd', color: '#0d47a1', border: 1, borderColor: '#bbdefb' }}
            >
                <strong>AI-Generated Summary:</strong> This overview is automatically synthesized from the patient's uploaded medical records and history. Please verify critical data against raw reports.
            </Alert>

            <Grid container spacing={4}>

                {/* Narrative Summary */}
                <Grid item xs={12}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Clinical Overview</Typography>
                    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', bgcolor: '#fbfbfb' }}>
                        <CardContent>
                            <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                                {summary.overview}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Key Diagnoses & Surgeries */}
                <Grid item xs={12} md={6}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Key Diagnoses</Typography>
                    <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                        {summary.keyDiagnoses.map((diag, index) => (
                            <React.Fragment key={index}>
                                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body1" fontWeight="bold">{diag.condition}</Typography>
                                    <Typography variant="caption" color="text.secondary">Diagnosed: {diag.date}</Typography>
                                </Box>
                                {index < summary.keyDiagnoses.length - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </Card>
                </Grid>

                {/* Highlights */}
                <Grid item xs={12} md={6}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Recent Test Highlights</Typography>
                    <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                        <CardContent>
                            {summary.recentHighlights.map((hl, index) => (
                                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                                    <Typography color="primary" fontWeight="bold">•</Typography>
                                    <Typography variant="body2">{hl}</Typography>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>
                </Grid>

            </Grid>
        </Box>
    );
}
