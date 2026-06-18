/**
 * Analytics.jsx
 *
 * Route: /analytics
 *
 * App.jsx lazy-imports "Analytics" but the full implementation is in
 * RevenueAnalytics.jsx (already built, 100% complete).
 *
 * Re-export RevenueAnalytics as the default to prevent the crash.
 */

export { default } from './RevenueAnalytics';
