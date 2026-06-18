/**
 * Dashboard.jsx
 *
 * Route: /dashboard
 *
 * App.jsx imports this as "Dashboard" but the real implementation lives in
 * OverviewDashboard.jsx (already built, 100% complete).
 *
 * This file acts as the canonical entry point — it simply re-exports
 * OverviewDashboard so App.jsx's lazy import resolves without crashing.
 *
 * If you want to later split them, replace this file's content.
 */

export { default } from './OverviewDashboard';
