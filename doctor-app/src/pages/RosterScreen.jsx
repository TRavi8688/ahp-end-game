// doctor-app/src/pages/RosterScreen.jsx
//
// NEW PAGE (item #10 — "give all possible ways to manage holidays,
// roster per month... we are making a system for every hospital"):
//
// A monthly calendar where a doctor sets their shift type per day
// (morning/afternoon/evening/night/on-call/off). Days that are hospital
// holidays or covered by an approved leave request are shown automatically
// and cannot be double-booked with a shift — the roster, holiday calendar,
// and leave system are all tied together via GET /doctor/roster, which
// merges all three server-side.

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Grid, Card, IconButton, Chip, Dialog, DialogTitle,
    DialogContent, DialogActions, Button, Select, MenuItem, TextField,
    CircularProgress, Alert, Tooltip,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CelebrationIcon from '@mui/icons-material/Celebration';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import { doctorService } from '../services/doctorService';

const SHIFT_CONFIG = {
    morning: { label: 'Morning', color: '#f59e0b', icon: <WbSunnyIcon fontSize="small" /> },
    afternoon: { label: 'Afternoon', color: '#0ea5e9', icon: <WbTwilightIcon fontSize="small" /> },
    evening: { label: 'Evening', color: '#8b5cf6', icon: <WbTwilightIcon fontSize="small" /> },
    night: { label: 'Night', color: '#6366f1', icon: <NightsStayIcon fontSize="small" /> },
    on_call: { label: 'On-Call', color: '#ef4444', icon: <PhoneInTalkIcon fontSize="small" /> },
    off: { label: 'Off', color: '#94a3b8', icon: null },
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function RosterScreen() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
    const [days, setDays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editDay, setEditDay] = useState(null);
    const [shiftType, setShiftType] = useState('morning');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
    const [newHolidayDate, setNewHolidayDate] = useState('');
    const [newHolidayName, setNewHolidayName] = useState('');
    const [savingHoliday, setSavingHoliday] = useState(false);

    const fetchRoster = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await doctorService.getRoster(year, month);
            setDays(data?.days || []);
        } catch (err) {
            console.error('Failed to load roster', err);
            setError('Could not load the roster for this month.');
        } finally {
            setLoading(false);
        }
    }, [year, month]);

    useEffect(() => { fetchRoster(); }, [fetchRoster]);

    const goToPreviousMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); } else { setMonth(m => m - 1); }
    };
    const goToNextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); } else { setMonth(m => m + 1); }
    };

    const openEditDialog = (day) => {
        if (day.is_holiday || day.is_on_leave) return; // can't assign shift on blocked days
        setEditDay(day);
        setShiftType(day.shift_type || 'morning');
        setStartTime(day.start_time || '09:00');
        setEndTime(day.end_time || '17:00');
        setNotes(day.notes || '');
        setEditDialogOpen(true);
    };

    const handleSaveShift = async () => {
        if (!editDay) return;
        setSaving(true);
        try {
            await doctorService.setRosterShift({
                shift_date: editDay.date,
                shift_type: shiftType,
                start_time: shiftType === 'off' ? null : startTime,
                end_time: shiftType === 'off' ? null : endTime,
                notes,
            });
            setEditDialogOpen(false);
            fetchRoster();
        } catch (err) {
            console.error('Failed to save shift', err);
            setError('Could not save this shift. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteShift = async () => {
        if (!editDay) return;
        setSaving(true);
        try {
            await doctorService.deleteRosterShift(editDay.date);
            setEditDialogOpen(false);
            fetchRoster();
        } catch (err) {
            console.error('Failed to clear shift', err);
        } finally {
            setSaving(false);
        }
    };

    const handleAddHoliday = async () => {
        if (!newHolidayDate || !newHolidayName) return;
        setSavingHoliday(true);
        try {
            await doctorService.createHoliday({
                holiday_date: newHolidayDate,
                name: newHolidayName,
                is_full_day: true,
            });
            setHolidayDialogOpen(false);
            setNewHolidayDate('');
            setNewHolidayName('');
            fetchRoster();
        } catch (err) {
            console.error('Failed to add holiday', err);
            setError('Could not add holiday — it may already exist for that date.');
        } finally {
            setSavingHoliday(false);
        }
    };

    // Build calendar grid with leading blanks for correct weekday alignment
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const leadingBlanks = (firstDayOfMonth + 6) % 7; // convert to Mon-first
    const calendarCells = [...Array(leadingBlanks).fill(null), ...days];

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 8 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#fff' }}>Monthly Roster</Typography>
                    <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                        Plan shifts, see holidays and approved leave at a glance
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<CelebrationIcon />}
                    onClick={() => setHolidayDialogOpen(true)}
                    sx={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', fontWeight: 700, textTransform: 'none' }}
                >
                    Add Holiday
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

            {/* Month navigator */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, mb: 3 }}>
                <IconButton onClick={goToPreviousMonth} sx={{ color: '#fff' }}><ArrowBackIosNewIcon fontSize="small" /></IconButton>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, minWidth: 200, textAlign: 'center' }}>
                    {MONTH_NAMES[month - 1]} {year}
                </Typography>
                <IconButton onClick={goToNextMonth} sx={{ color: '#fff' }}><ArrowForwardIosIcon fontSize="small" /></IconButton>
            </Box>

            {/* Legend */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3, justifyContent: 'center' }}>
                {Object.entries(SHIFT_CONFIG).map(([key, cfg]) => (
                    <Chip key={key} size="small" icon={cfg.icon || undefined} label={cfg.label}
                        sx={{ bgcolor: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40`, fontWeight: 700 }} />
                ))}
                <Chip size="small" icon={<CelebrationIcon fontSize="small" />} label="Holiday"
                    sx={{ bgcolor: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)', fontWeight: 700 }} />
                <Chip size="small" icon={<EventBusyIcon fontSize="small" />} label="On Leave"
                    sx={{ bgcolor: 'rgba(148,163,184,0.15)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.4)', fontWeight: 700 }} />
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: '#0d9488' }} /></Box>
            ) : (
                <Card elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, p: 2 }}>
                    {/* Weekday header */}
                    <Grid container sx={{ mb: 1 }}>
                        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
                            <Grid item xs key={d}>
                                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 800, display: 'block', textAlign: 'center', letterSpacing: 1 }}>{d}</Typography>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Calendar grid */}
                    <Grid container>
                        {calendarCells.map((day, idx) => {
                            if (!day) return <Grid item xs key={`blank-${idx}`} sx={{ minHeight: 90 }} />;

                            const shiftCfg = day.shift_type ? SHIFT_CONFIG[day.shift_type] : null;
                            const dayNum = day.date.split('-')[2];
                            const isBlocked = day.is_holiday || day.is_on_leave;

                            return (
                                <Grid item xs key={day.date} sx={{ p: 0.5 }}>
                                    <Tooltip title={day.is_holiday ? day.holiday_name : day.is_on_leave ? 'On approved leave' : (shiftCfg ? shiftCfg.label : 'Click to assign a shift')}>
                                        <Box
                                            onClick={() => openEditDialog(day)}
                                            sx={{
                                                minHeight: 90,
                                                borderRadius: 2,
                                                p: 1,
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                bgcolor: day.is_holiday
                                                    ? 'rgba(236,72,153,0.08)'
                                                    : day.is_on_leave
                                                        ? 'rgba(148,163,184,0.08)'
                                                        : shiftCfg
                                                            ? `${shiftCfg.color}10`
                                                            : 'transparent',
                                                cursor: isBlocked ? 'default' : 'pointer',
                                                transition: 'all 0.15s',
                                                '&:hover': isBlocked ? {} : { borderColor: '#0d9488', transform: 'scale(1.02)' },
                                            }}
                                        >
                                            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700 }}>{dayNum}</Typography>
                                            {day.is_holiday && (
                                                <Box sx={{ mt: 0.5 }}>
                                                    <CelebrationIcon sx={{ fontSize: 14, color: '#ec4899' }} />
                                                    <Typography variant="caption" sx={{ display: 'block', color: '#ec4899', fontSize: '0.6rem', fontWeight: 700 }}>
                                                        {(day.holiday_name || '').slice(0, 12)}
                                                    </Typography>
                                                </Box>
                                            )}
                                            {day.is_on_leave && !day.is_holiday && (
                                                <Box sx={{ mt: 0.5 }}>
                                                    <EventBusyIcon sx={{ fontSize: 14, color: '#cbd5e1' }} />
                                                    <Typography variant="caption" sx={{ display: 'block', color: '#cbd5e1', fontSize: '0.6rem', fontWeight: 700 }}>On Leave</Typography>
                                                </Box>
                                            )}
                                            {!isBlocked && shiftCfg && (
                                                <Box sx={{ mt: 0.5 }}>
                                                    {shiftCfg.icon}
                                                    <Typography variant="caption" sx={{ display: 'block', color: shiftCfg.color, fontSize: '0.65rem', fontWeight: 700 }}>
                                                        {shiftCfg.label}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </Tooltip>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Card>
            )}

            {/* Edit Shift Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
                <DialogTitle sx={{ color: '#fff', fontWeight: 800 }}>
                    {editDay && `Shift for ${editDay.date}`}
                </DialogTitle>
                <DialogContent>
                    <Select
                        fullWidth
                        value={shiftType}
                        onChange={(e) => setShiftType(e.target.value)}
                        sx={{ color: '#fff', mb: 2, mt: 1, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
                    >
                        {Object.entries(SHIFT_CONFIG).map(([key, cfg]) => (
                            <MenuItem key={key} value={key}>{cfg.label}</MenuItem>
                        ))}
                    </Select>
                    {shiftType !== 'off' && (
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                            <TextField
                                label="Start"
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ input: { color: '#fff' } }}
                                fullWidth
                            />
                            <TextField
                                label="End"
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ input: { color: '#fff' } }}
                                fullWidth
                            />
                        </Box>
                    )}
                    <TextField
                        label="Notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        InputLabelProps={{ shrink: true }}
                        sx={{ textarea: { color: '#fff' } }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    {editDay?.shift_type && (
                        <Button onClick={handleDeleteShift} disabled={saving} startIcon={<DeleteIcon />} sx={{ color: '#ef4444', mr: 'auto' }}>
                            Clear
                        </Button>
                    )}
                    <Button onClick={() => setEditDialogOpen(false)} sx={{ color: '#cbd5e1' }}>Cancel</Button>
                    <Button onClick={handleSaveShift} variant="contained" disabled={saving} sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' } }}>
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Holiday Dialog */}
            <Dialog open={holidayDialogOpen} onClose={() => setHolidayDialogOpen(false)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
                <DialogTitle sx={{ color: '#fff', fontWeight: 800 }}>Add Hospital Holiday</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Date"
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        sx={{ mb: 2, mt: 1, input: { color: '#fff' } }}
                    />
                    <TextField
                        label="Holiday Name"
                        placeholder="e.g. Independence Day"
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        sx={{ input: { color: '#fff' } }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setHolidayDialogOpen(false)} sx={{ color: '#cbd5e1' }}>Cancel</Button>
                    <Button
                        onClick={handleAddHoliday}
                        variant="contained"
                        disabled={savingHoliday || !newHolidayDate || !newHolidayName}
                        startIcon={<AddIcon />}
                        sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' } }}
                    >
                        {savingHoliday ? 'Adding...' : 'Add Holiday'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
