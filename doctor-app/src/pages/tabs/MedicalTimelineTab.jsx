import React from 'react';
import { Box, Typography, Stack, Divider, Chip } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import VaccinesIcon from '@mui/icons-material/Vaccines';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation';

export default function MedicalTimelineTab() {
    const events = [
        { date: "Oct 12, 2024", title: "Routine Checkup", doctor: "Dr. Gregory House", type: "Visit", icon: <MedicalInformationIcon /> },
        { date: "Aug 15, 2024", title: "Lipid Panel Lab", doctor: "PathLabs Inc.", type: "Test", icon: <VaccinesIcon color="secondary" /> },
        { date: "Jun 01, 2024", title: "Retinal Screening", doctor: "Dr. Lisa Cuddy", type: "Scan", icon: <MedicalInformationIcon /> },
        { date: "Mar 10, 2018", title: "Appendectomy", doctor: "Princeton-Plainsboro", type: "Surgery", icon: <LocalHospitalIcon color="error" /> },
    ];

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 2 }}>
            <Typography variant="h6" fontWeight="bold" mb={4}>Chronological Medical History</Typography>

            <Stack spacing={0}>
                {events.map((event, index) => (
                    <Box key={index} sx={{ display: 'flex', minHeight: 100 }}>
                        {/* Date Column */}
                        <Box sx={{ width: 120, textAlign: 'right', pr: 3, pt: 0.5 }}>
                            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">{event.date}</Typography>
                        </Box>

                        {/* Line & Dot */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            <CircleIcon sx={{ fontSize: 16, color: 'primary.main', zIndex: 1, bgcolor: 'white' }} />
                            {index < events.length - 1 && (
                                <Box sx={{ width: 2, flexGrow: 1, bgcolor: 'divider', position: 'absolute', top: 16, bottom: -16 }} />
                            )}
                        </Box>

                        {/* Content Column */}
                        <Box sx={{ pl: 4, pb: 4, flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                                {event.icon}
                                <Typography variant="h6" fontWeight="bold">{event.title}</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" mb={1}>{event.doctor}</Typography>
                            <Chip label={event.type} size="small" variant="outlined" />
                        </Box>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
}
