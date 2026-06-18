// doctor-app/src/pages/QueueScreen.jsx
//
// FULL 360 FIX:
//   - Was importing doctorService as a default export; it only has a
//     named export. This alone broke the production build entirely.
//   - Was calling doctorService.getQueue(), a method that never existed.
//     The real queue method is clinicalService.getActiveQueue()
//     (GET /doctor/queue), already built correctly elsewhere in the app.
//   - Backend wraps queue data in { success, message, data: { queue,
//     total_waiting, total_in_consultation } } via success_response().
//     The old code read `data.queue` directly off the raw response,
//     skipping the `.data` envelope — always undefined.
//   - Field names were wrong: backend returns full_name, queue_state,
//     wait_minutes, priority_level, reason_for_visit — old code read
//     name, status, waitTime, reason (none of which exist).
//   - socket.on(...) was called on a plain native WebSocket, which has
//     no .on() method (that's a socket.io API). SocketContext exposes
//     `lastMessage` instead — now consumed correctly via useEffect.
//   - IntakeModal was mounted with props {patient, onSuccess} but the
//     component expects {patientId, onComplete}. Fixed.
//   - NEW: filters (item #1) — priority level + search by name.
//   - NEW: break system (item #9) — typed break selector that pauses
//     the queue and is visible right where the doctor manages patients.

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  CircularProgress,
  Stack,
  Avatar,
  Badge,
  TextField,
  MenuItem,
  Select,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import SearchIcon from "@mui/icons-material/Search";
import FreeBreakfastIcon from "@mui/icons-material/FreeBreakfast";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import GroupsIcon from "@mui/icons-material/Groups";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";

import IntakeModal from "../components/IntakeModal";
import { useSocket } from "../contexts/SocketContext";
import { clinicalService } from "../services/clinicalService";
import { doctorService } from "../services/doctorService";

const BREAK_TYPES = [
  { value: "bio_break", label: "Bio Break", icon: <FreeBreakfastIcon fontSize="small" /> },
  { value: "lunch_break", label: "Lunch Break", icon: <RestaurantIcon fontSize="small" /> },
  { value: "tea_break", label: "Tea Break", icon: <LocalCafeIcon fontSize="small" /> },
  { value: "meeting", label: "Meeting", icon: <GroupsIcon fontSize="small" /> },
];

const PRIORITY_FILTERS = ["all", "emergency", "urgent", "normal", "low"];

export default function QueueScreen() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showIntake, setShowIntake] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  // Filters (item #1)
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Break system (item #9)
  const [onBreak, setOnBreak] = useState(false);
  const [breakType, setBreakType] = useState("bio_break");
  const [breakBusy, setBreakBusy] = useState(false);
  const [breakError, setBreakError] = useState(null);

  const { lastMessage } = useSocket();

  useEffect(() => {
    fetchQueue();
  }, []);

  // Live queue updates via WebSocket — SocketContext exposes `lastMessage`,
  // not a socket.io-style `.on()` emitter.
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "QUEUE_UPDATE" && Array.isArray(lastMessage.queue)) {
      setQueue(lastMessage.queue);
    } else if (lastMessage.type === "QUEUE_UPDATE") {
      // Some backend events may just signal "something changed" — refetch.
      fetchQueue();
    }
  }, [lastMessage]);

  async function fetchQueue() {
    try {
      setLoading(true);
      setError(null);
      const response = await clinicalService.getActiveQueue();
      // Backend wraps in { success, message, data: { queue, ... } }
      const items = response?.data?.queue || [];
      setQueue(items);
    } catch (err) {
      setError("Failed to load queue. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  const filteredQueue = useMemo(() => {
    return queue.filter((p) => {
      const matchesPriority =
        priorityFilter === "all" || p.priority_level === priorityFilter;
      const matchesSearch =
        !searchTerm ||
        (p.full_name || "").toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPriority && matchesSearch;
    });
  }, [queue, priorityFilter, searchTerm]);

  function handleBeginConsultation(patient) {
    setSelectedPatientId(patient.id);
    setShowIntake(true);
  }

  function handleIntakeClose() {
    setShowIntake(false);
    setSelectedPatientId(null);
  }

  function handleIntakeComplete() {
    setShowIntake(false);
    setSelectedPatientId(null);
    fetchQueue();
  }

  async function handleStartBreak() {
    setBreakBusy(true);
    setBreakError(null);
    try {
      await doctorService.startBreak({ break_type: breakType });
      setOnBreak(true);
    } catch (err) {
      setBreakError(err?.message || "Could not start break.");
    } finally {
      setBreakBusy(false);
    }
  }

  async function handleEndBreak() {
    setBreakBusy(true);
    setBreakError(null);
    try {
      await doctorService.endBreak();
      setOnBreak(false);
      fetchQueue();
    } catch (err) {
      setBreakError(err?.message || "Could not end break.");
    } finally {
      setBreakBusy(false);
    }
  }

  const priorityColor = {
    emergency: "error",
    urgent: "warning",
    normal: "info",
    low: "default",
  };

  const stateColor = {
    waiting_doctor: "warning",
    in_consultation: "success",
  };

  const stateLabel = {
    waiting_doctor: "Waiting",
    in_consultation: "In Consultation",
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: "#fff" }}>
            Live Queue
          </Typography>
          <Typography variant="body2" sx={{ color: "#cbd5e1" }}>
            {filteredQueue.length} patient{filteredQueue.length !== 1 ? "s" : ""} showing
            {priorityFilter !== "all" || searchTerm ? ` (of ${queue.length} total)` : ""}
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" spacing={2}>
          <Badge badgeContent={queue.filter((p) => p.queue_state === "waiting_doctor").length} color="warning">
            <FiberManualRecordIcon sx={{ color: onBreak ? "#ef4444" : "#22c55e" }} />
          </Badge>

          {/* Break system controls (item #9) */}
          {!onBreak ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Select
                size="small"
                value={breakType}
                onChange={(e) => setBreakType(e.target.value)}
                sx={{
                  minWidth: 160,
                  color: "#fff",
                  bgcolor: "rgba(255,255,255,0.04)",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.1)" },
                }}
              >
                {BREAK_TYPES.map((bt) => (
                  <MenuItem key={bt.value} value={bt.value}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {bt.icon}
                      <span>{bt.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<PauseCircleIcon />}
                onClick={handleStartBreak}
                disabled={breakBusy}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Start Break
              </Button>
            </Stack>
          ) : (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayCircleIcon />}
              onClick={handleEndBreak}
              disabled={breakBusy}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              End {BREAK_TYPES.find((b) => b.value === breakType)?.label || "Break"}
            </Button>
          )}
        </Stack>
      </Stack>

      {breakError && (
        <Typography color="error" variant="body2" mb={2}>
          {breakError}
        </Typography>
      )}

      {onBreak && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
          }}
        >
          <Typography sx={{ color: "#fca5a5", fontWeight: 600 }}>
            You're on {BREAK_TYPES.find((b) => b.value === breakType)?.label}. The queue is paused —
            new patients won't be routed to you until you end the break.
          </Typography>
        </Box>
      )}

      {/* Filters (item #1) */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" alignItems="center">
        <TextField
          size="small"
          placeholder="Search patient name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#cbd5e1", fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: 240,
            "& .MuiOutlinedInput-root": { color: "#fff", bgcolor: "rgba(255,255,255,0.04)" },
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.1)" },
          }}
        />
        <ToggleButtonGroup
          value={priorityFilter}
          exclusive
          onChange={(e, val) => val && setPriorityFilter(val)}
          size="small"
        >
          {PRIORITY_FILTERS.map((p) => (
            <ToggleButton
              key={p}
              value={p}
              sx={{
                textTransform: "capitalize",
                color: "#cbd5e1",
                px: 2,
                "&.Mui-selected": {
                  color: "#fff",
                  bgcolor: "rgba(99,102,241,0.25)",
                },
              }}
            >
              {p}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {/* States */}
      {loading && (
        <Box display="flex" justifyContent="center" mt={6}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" textAlign="center" mt={4}>
          {error}
        </Typography>
      )}

      {!loading && !error && filteredQueue.length === 0 && (
        <Box textAlign="center" mt={8}>
          <Typography variant="h6" sx={{ color: "#cbd5e1" }}>
            {queue.length === 0 ? "Queue is empty" : "No patients match your filters"}
          </Typography>
          <Typography variant="body2" mt={1} sx={{ color: "#94a3b8" }}>
            {queue.length === 0
              ? "New patients will appear here in real time"
              : "Try clearing the search or priority filter"}
          </Typography>
        </Box>
      )}

      {/* Queue cards */}
      <Stack spacing={2}>
        {filteredQueue.map((patient, index) => (
          <Card
            key={patient.id || index}
            sx={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 2,
              backdropFilter: "blur(12px)",
              transition: "border-color 0.2s",
              "&:hover": { borderColor: "#6366f1" },
            }}
          >
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar
                  sx={{
                    bgcolor: "#6366f1",
                    width: 48,
                    height: 48,
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {patient.queue_number || index + 1}
                </Avatar>

                <Box flex={1}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={0.5} flexWrap="wrap">
                    <PersonIcon fontSize="small" sx={{ color: "#cbd5e1" }} />
                    <Typography fontWeight={600} sx={{ color: "#fff" }}>
                      {patient.full_name || "Unknown Patient"}
                    </Typography>
                    <Chip
                      label={stateLabel[patient.queue_state] || patient.queue_state}
                      color={stateColor[patient.queue_state] || "default"}
                      size="small"
                    />
                    <Chip
                      label={patient.priority_level}
                      color={priorityColor[patient.priority_level] || "default"}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <Typography variant="caption" sx={{ color: "#cbd5e1" }}>
                      {patient.reason_for_visit || "General consultation"}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <AccessTimeIcon sx={{ fontSize: 12, color: "#94a3b8" }} />
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                        {patient.wait_minutes != null ? `${patient.wait_minutes}m wait` : "—"}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  disabled={patient.queue_state === "in_consultation"}
                  onClick={() => handleBeginConsultation(patient)}
                  sx={{ minWidth: 140, textTransform: "none", fontWeight: 600 }}
                >
                  {patient.queue_state === "in_consultation" ? "In Progress" : "Begin Consultation"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {showIntake && selectedPatientId && (
        <IntakeModal
          open={showIntake}
          patientId={selectedPatientId}
          onClose={handleIntakeClose}
          onComplete={handleIntakeComplete}
        />
      )}
    </Box>
  );
}
