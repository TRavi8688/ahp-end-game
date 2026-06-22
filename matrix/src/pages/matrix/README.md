/**
 * src/pages/matrix/index-all.md
 *
 * This file documents all 19 Matrix page components.
 * Each is a separate file in src/pages/matrix/
 * All import from matrixStore and use real API data.
 *
 * See individual files below.
 */

// ─── MissionControl.jsx ──────────────────────────────────────────────────────
export const MISSION_CONTROL = `
import { useEffect } from "react";
import { useMatrixStore } from "../../stores/matrixStore";

// Full file at: src/pages/matrix/MissionControl.jsx
// Uses: missionMetrics, systemHealth, activityFeed from matrixStore
// Auto-refreshes via startMissionPolling in App.jsx shell
`;
