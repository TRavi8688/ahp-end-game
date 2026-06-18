/**
 * Hospitals.jsx
 *
 * Route: /hospitals
 *
 * App.jsx lazy-imports "Hospitals" but the full implementation lives in
 * HospitalNetwork.jsx (already built, 100% complete).
 *
 * Re-export HospitalNetwork as the default to prevent the crash.
 * HospitalNetwork renders the full hospital list + map + filter UI.
 */

export { default } from './HospitalNetwork';
