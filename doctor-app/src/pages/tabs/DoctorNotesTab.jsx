import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, Divider, IconButton, Tooltip } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import SaveIcon from '@mui/icons-material/Save';
import StarBorderIcon from '@mui/icons-material/StarBorder';

export default function DoctorNotesTab() {
    const [note, setNote] = useState('');
    const [savedNotes, setSavedNotes] = useState([
        { date: "Oct 12, 2024", text: "Patient reported mild tingling in lower extremities. Suggests early peripheral neuropathy. Ordered nerve conduction study. Continue current Metformin dosage.", marked: true },
        { date: "Aug 15, 2024", text: "Lipid levels controlled. Discussed diet adherence. No changes to Atorvastatin.", marked: false }
    ]);
    const [isRecording, setIsRecording] = useState(false);

    const handleSave = () => {
        if (!note.trim()) return;
        setSavedNotes([{ date: "Just now", text: note, marked: false }, ...savedNotes]);
        setNote('');
    };

    const toggleRecording = () => {
        setIsRecording(!isRecording);
        if (!isRecording) {
            // Mock dictation
            setTimeout(() => {
                setNote(prev => prev + " patient presents with mild cough and fever ");
                setIsRecording(false);
            }, 2000);
        }
    };

    return (
        <Box sx={{ maxWidth: 900, mx: 'auto', display: 'flex', gap: 4, height: '100%' }}>

            {/* Editor Section */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Add Clinical Note</Typography>

                <Paper elevation={0} sx={{ flexGrow: 1, border: 1, borderColor: 'divider', p: 2, display: 'flex', flexDirection: 'column', bgcolor: '#fbfbfb' }}>

                    <TextField
                        multiline
                        fullWidth
                        placeholder="Type or dictate clinical notes here..."
                        variant="standard"
                        InputProps={{ disableUnderline: true, sx: { fontSize: '1.1rem', lineHeight: 1.6 } }}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        sx={{ flexGrow: 1, overflowY: 'auto' }}
                    />

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tooltip title="Voice-to-Text Dictation">
                            <Button
                                variant={isRecording ? "contained" : "outlined"}
                                color={isRecording ? "error" : "primary"}
                                startIcon={<MicIcon />}
                                onClick={toggleRecording}
                                sx={{ borderRadius: 8 }}
                            >
                                {isRecording ? "Listening..." : "Dictate Note"}
                            </Button>
                        </Tooltip>

                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disabled={!note.trim() && !isRecording}
                        >
                            Save Note
                        </Button>
                    </Box>
                </Paper>
            </Box>

            {/* History Section */}
            <Box sx={{ width: 350, borderLeft: 1, borderColor: 'divider', pl: 4, overflowY: 'auto' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Previous Notes</Typography>

                {savedNotes.map((n, i) => (
                    <Paper key={i} elevation={0} sx={{ border: 1, borderColor: n.marked ? '#ffc107' : 'divider', bgcolor: n.marked ? '#fffdf5' : '#fff', p: 2, mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold">{n.date}</Typography>
                            <IconButton size="small" color={n.marked ? "warning" : "default"}>
                                <StarBorderIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        <Typography variant="body2">{n.text}</Typography>
                    </Paper>
                ))}

            </Box>

        </Box>
    );
}
