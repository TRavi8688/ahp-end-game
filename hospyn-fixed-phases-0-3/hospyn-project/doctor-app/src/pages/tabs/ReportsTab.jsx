import React from 'react';
import { Box, Typography, Card, CardContent, CardActions, Button, Grid, Chip } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import DescriptionIcon from '@mui/icons-material/Description';

export default function ReportsTab() {
    const reports = [
        { title: "HbA1c Blood Test", category: "Lab Report", date: "Oct 12, 2024", source: "PathLabs Inc." },
        { title: "Lipid Panel", category: "Lab Report", date: "Aug 15, 2024", source: "PathLabs Inc." },
        { title: "Chest X-Ray", category: "Imaging", date: "Jan 10, 2023", source: "Princeton-Plainsboro" },
        { title: "Discharge Summary", category: "Clinical Notes", date: "Mar 12, 2018", source: "Princeton-Plainsboro" },
    ];

    const getIcon = (category) => {
        switch (category) {
            case 'Imaging': return <ImageSearchIcon sx={{ fontSize: 40, color: '#1976d2' }} />;
            default: return <DescriptionIcon sx={{ fontSize: 40, color: '#388e3c' }} />;
        }
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

            {/* Filters Placeholder */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Chip label="All Records" color="primary" onClick={() => { }} />
                    <Chip label="Lab Reports" variant="outlined" onClick={() => { }} />
                    <Chip label="Imaging (X-ray, MRI)" variant="outlined" onClick={() => { }} />
                    <Chip label="Discharge Summaries" variant="outlined" onClick={() => { }} />
                </Box>
                <Button variant="contained" color="primary" startIcon={<DescriptionIcon />}>
                    Upload New Record
                </Button>
            </Box>

            <Grid container spacing={3}>
                {reports.map((report, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                    {getIcon(report.category)}
                                    <Chip size="small" label={report.category} />
                                </Box>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>{report.title}</Typography>
                                <Typography variant="body2" color="text.secondary">{report.source}</Typography>
                                <Typography variant="caption" color="text.secondary">Date: {report.date}</Typography>
                            </CardContent>
                            <CardActions sx={{ borderTop: 1, borderColor: 'divider', p: 1.5 }}>
                                <Button size="small" startIcon={<FileDownloadIcon />}>Download Document</Button>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
