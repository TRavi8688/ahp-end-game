import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, Divider, Avatar, Chip, IconButton, InputBase, Button, List, ListItem, Tooltip, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { clinicalService } from '../services/clinicalService';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import WarningIcon from '@mui/icons-material/Warning';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MedicationIcon from '@mui/icons-material/Medication';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';


export default function PatientList() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [selectedPatientData, setSelectedPatientData] = useState(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch Patient List
    React.useEffect(() => {
        const abortController = new AbortController();

        const fetchPatients = async () => {
            try {
                const data = await clinicalService.getMyPatients(abortController.signal);
                setPatients(data);
            } catch (error) {
                if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                    console.error("Failed to fetch patients", error);
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchPatients();

        return () => {
            abortController.abort();
        };
    }, []);

    // Fetch Patient Detail when selected
    React.useEffect(() => {
        if (!selectedPatientId) return;

        const abortController = new AbortController();

        const fetchDetail = async () => {
            setIsLoadingDetail(true);
            try {
                const data = await clinicalService.getPatientDetails(selectedPatientId, abortController.signal);
                setSelectedPatientData(data);
            } catch (error) {
                if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                    console.error("Failed to fetch details", error);
                }
            } finally {
                setIsLoadingDetail(false);
            }
        };
        fetchDetail();

        return () => {
            abortController.abort();
        };
    }, [selectedPatientId]);

    // Filter logic
    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.hospyn_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status) => {
        if (status === 'urgent') return '#ef4444'; // Red
        if (status === 'followup') return '#f59e0b'; // Amber
        return '#10b981'; // Green
    };

    return (
        <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 3, mx: 'auto', background: 'transparent' }}>

            {/* Left Pane - Intelligence Roster */}
            <Box className="glass-card" sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden', 
                border: '1px solid rgba(255,255,255,0.05)', 
                bgcolor: 'rgba(255,255,255,0.02)',
                borderRadius: '32px',
                backdropFilter: 'blur(40px)'
            }}>
                {/* Precision Search Header */}
                <Box sx={{ p: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: '20px',
                        px: 3,
                        py: 1.5,
                        border: '1px solid rgba(255,255,255,0.05)',
                        '&:focus-within': { borderColor: '#0d9488', bgcolor: 'rgba(13, 148, 136, 0.02)' }
                    }}>
                        <SearchIcon sx={{ color: '#64748b', mr: 2 }} />
                        <InputBase
                            placeholder="Locate patient by name or Hospain identity..."
                            sx={{ flex: 1, fontSize: '0.95rem', color: 'white', fontWeight: 500 }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </Box>
                    <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: '#fff', borderRadius: '16px', p: 1.8, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <FilterListIcon />
                    </IconButton>
                </Box>

                {/* Directory Body */}
                <List sx={{ flex: 1, overflowY: 'auto', p: 0, px: 2 }}>
                    {isLoading ? (
                        <Box sx={{ p: 10, textAlign: 'center' }}>
                            <CircularProgress size={30} sx={{ color: '#0d9488', mb: 2 }} />
                            <Typography sx={{ color: '#64748b', fontWeight: 700, letterSpacing: 1 }}>SYNCHRONIZING ROSTER...</Typography>
                        </Box>
                    ) : filteredPatients.map((patient) => {
                        const isRevoked = patient.access_level === 'revoked';
                        const isSelected = selectedPatientId === patient.id && !isRevoked;

                        return (
                            <Tooltip title={isRevoked ? "Restricted: Access revoked by subject" : ""} placement="right" key={patient.id}>
                                <ListItem
                                    button={!isRevoked}
                                    onClick={() => !isRevoked && setSelectedPatientId(patient.id)}
                                    sx={{
                                        mx: 2,
                                        my: 1,
                                        borderRadius: '24px',
                                        p: 3,
                                        bgcolor: isSelected ? 'rgba(13, 148, 136, 0.1)' : 'transparent',
                                        border: isSelected ? '1px solid rgba(13, 148, 136, 0.3)' : '1px solid transparent',
                                        opacity: isRevoked ? 0.3 : 1,
                                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                        '&:hover': {
                                            bgcolor: isRevoked ? 'transparent' : 'rgba(255,255,255,0.03)',
                                            transform: isRevoked ? 'none' : 'translateX(8px)'
                                        }
                                    }}
                                >
                                    {/* Medical Avatar */}
                                    <Avatar sx={{ 
                                        bgcolor: isSelected ? '#0d9488' : 'rgba(255,255,255,0.05)', 
                                        color: isSelected ? '#fff' : '#6366f1', 
                                        width: 56, 
                                        height: 56, 
                                        mr: 3, 
                                        fontWeight: 900,
                                        fontFamily: 'Outfit',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        boxShadow: isSelected ? '0 0 20px rgba(13, 148, 136, 0.2)' : 'none'
                                    }}>
                                        {patient.name.split(' ').map(n => n[0]).join('')}
                                    </Avatar>

                                    {/* Data Cluster */}
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 800, fontFamily: 'Outfit', mb: 0.2 }}>
                                            {patient.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontWeight: 800, mb: 1, letterSpacing: 0.5, fontFamily: 'monospace' }}>
                                            {patient.hospyn_id}
                                        </Typography>

                                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                                            {isRevoked ? (
                                                <Chip size="small" label="ACCESS REVOKED" sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 900, height: 22, fontSize: '0.65rem' }} />
                                            ) : (
                                                <Chip size="small" label={patient.access_level.toUpperCase()} sx={{ bgcolor: 'rgba(13, 148, 136, 0.1)', color: '#0d9488', fontWeight: 900, height: 22, fontSize: '0.65rem', border: '1px solid rgba(13, 148, 136, 0.2)' }} />
                                            )}
                                            <Chip size="small" label="STABLE" sx={{ bgcolor: 'rgba(255,255,255,0.02)', color: '#64748b', fontWeight: 900, height: 22, fontSize: '0.65rem' }} />
                                        </Box>
                                    </Box>

                                    {/* Metadata */}
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800, fontSize: '0.7rem' }}>
                                            LAST SYNC
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontFamily: 'monospace', mt: 0.5 }}>
                                            {new Date(patient.granted_at).toLocaleDateString([], { month: 'short', day: '2-digit' })}
                                        </Typography>
                                    </Box>
                                </ListItem>
                            </Tooltip>
                        );
                    })}
                </List>
            </Box>

            {/* Right Pane - Intelligence Briefing */}
            <Box className="glass-card" sx={{ 
                width: 420, 
                flexShrink: 0, 
                bgcolor: 'rgba(255,255,255,0.02)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                display: 'flex', 
                flexDirection: 'column',
                borderRadius: '32px',
                backdropFilter: 'blur(40px)',
                overflow: 'hidden'
            }}>
                {!selectedPatientData ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 6, textAlign: 'center' }}>
                        <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '30%' }}>
                            <FolderSharedIcon sx={{ fontSize: 48, color: '#334155' }} />
                        </Box>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 900, mt: 3, fontFamily: 'Outfit' }}>
                            {isLoadingDetail ? "RETRIVING..." : "SELECT NODE"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', mt: 1.5, fontWeight: 500 }}>
                            {isLoadingDetail ? "Establishing encrypted link to Hospain ledger." : "Choose a valid practitioner link to view deep clinical context."}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {/* Preview Header */}
                        <Box sx={{ p: 5, textAlign: 'center', background: 'linear-gradient(180deg, rgba(13, 148, 136, 0.05) 0%, transparent 100%)' }}>
                            <Avatar sx={{ 
                                width: 100, 
                                height: 100, 
                                mx: 'auto', 
                                mb: 3, 
                                bgcolor: '#0d9488', 
                                fontSize: '2.5rem', 
                                fontWeight: 900,
                                fontFamily: 'Outfit',
                                border: '4px solid #050810',
                                boxShadow: '0 10px 30px rgba(13, 148, 136, 0.2)'
                            }}>
                                {(selectedPatientData.profile.name || 'Hospain Patient').split(' ').map(n => n[0]).join('')}
                            </Avatar>
                            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, fontFamily: 'Outfit', mb: 1 }}>{selectedPatientData.profile.name || 'Hospain Patient'}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                                    {selectedPatientData.profile.age !== undefined && selectedPatientData.profile.age !== null ? `${selectedPatientData.profile.age} YRS` : 'SECURE'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#334155' }}>•</Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                                    {selectedPatientData.profile.gender ? selectedPatientData.profile.gender.toUpperCase() : 'SECURE'}
                                </Typography>
                            </Box>
                            <Box sx={{ px: 2, py: 0.8, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px', display: 'inline-block', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#0d9488', fontWeight: 800 }}>{selectedPatientData.profile.hospyn_id}</Typography>
                            </Box>
                        </Box>

                        <Box sx={{ p: 4, flex: 1, overflowY: 'auto' }}>
                            {/* AI Summary Extract */}
                            <Box sx={{ mb: 4, p: 3, bgcolor: 'rgba(99, 102, 241, 0.03)', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                    <InfoOutlinedIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                                    <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 900, letterSpacing: 1 }}>CORE CONTEXT</Typography>
                                </Box>
                                <Typography variant="body2" sx={{ color: '#94a3b8', lineHeight: 1.6, fontWeight: 500, fontFamily: 'Inter' }}>
                                    {selectedPatientData.ai_summary || "Intelligence node synthesis pending. Access full profile for deep analysis."}
                                </Typography>
                            </Box>

                            {/* Indicators */}
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="overline" sx={{ color: '#475569', fontWeight: 900, mb: 2, display: 'block', letterSpacing: 1 }}>CLINICAL MARKERS</Typography>
                                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                                    {(selectedPatientData.allergies || []).length > 0 && <Chip label="SENSITIVITIES" size="small" sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 900, fontSize: '0.65rem' }} />}
                                    {(selectedPatientData.conditions || []).map(cond => (
                                        <Chip key={cond.id} label={cond.name.toUpperCase()} size="small" sx={{ bgcolor: 'rgba(13, 148, 136, 0.05)', color: '#0d9488', fontWeight: 900, fontSize: '0.65rem', border: '1px solid rgba(13, 148, 136, 0.1)' }} />
                                    ))}
                                </Box>
                            </Box>
                        </Box>

                        {/* Action Hub */}
                        <Box sx={{ p: 4, borderTop: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.01)' }}>
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={() => navigate(
                                    selectedPatientData.profile.walkin_id
                                        ? `/patient/${selectedPatientData.profile.walkin_id}`
                                        : `/patient-record/${selectedPatientData.profile.id}`
                                )}
                                sx={{
                                    bgcolor: '#0d9488',
                                    transform: 'none',
                                    '&:hover': { bgcolor: '#0f766e', transform: 'translateY(-2px)' },
                                    textTransform: 'none',
                                    py: 2,
                                    borderRadius: '16px',
                                    fontWeight: 900,
                                    fontSize: '1rem',
                                    boxShadow: '0 8px 24px rgba(13, 148, 136, 0.2)',
                                    mb: 2,
                                    transition: 'all 0.2s'
                                }}
                            >
                                Launch Visualizer
                            </Button>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={() => navigate(`/prescriptions/${selectedPatientData.profile.id}`, { state: { patient: selectedPatientData.profile } })}
                                sx={{ 
                                    color: '#fff', 
                                    borderColor: 'rgba(255,255,255,0.1)', 
                                    textTransform: 'none', 
                                    py: 1.8, 
                                    borderRadius: '16px',
                                    fontWeight: 700,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)' }
                                }}
                            >
                                Rapid Prescription
                            </Button>
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
}
