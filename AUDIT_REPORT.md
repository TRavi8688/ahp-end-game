# Hospyn Super Admin Dashboard — Complete 360° Audit Report

## TWO FRONTEND FOLDERS — WHICH IS REAL?

`super-admin-dashboard/` = **THE REAL APP** (has package.json, full Vite/React setup)  
`super-admin/` = Patch notes folder (a previous fix pack — copy these into super-admin-dashboard)

---

## CRITICAL BUGS FOUND

### 🔴 BUG 1 — Login sends wrong field, backend rejects it
**File:** `src/pages/Login.jsx`  
`api.post('/api/v1/auth/login', { phone_number: ..., password: ... })`  
**Backend (`v1/auth.py`):** reads `body.get("username") or body.get("email") or body.get("phone")`  
→ `phone_number` key is NEVER read. Login always fails silently.  
**Fix:** Send `{ phone: form.phone_number, password: form.password }`

### 🔴 BUG 2 — Login response shape mismatch, auth store never set
**File:** `src/pages/Login.jsx`  
Checks `data?.access_token && data?.user`  
**Backend returns:** `{ access_token, token_type, user: { id, role } }`  
→ `data.user.role` exists but is just `"role_string"`, not `"super_admin"`.  
Backend role token is `"super_admin"` only if the user was registered with that role.  
**Fix:** Accept the token unconditionally once role check passes.

### 🔴 BUG 3 — Duplicate & conflicting API clients (3 different ones)
- `src/lib/apiClient.js` — fetch-based, uses in-memory token ✅ correct
- `src/services/apiClient.js` — broken re-export: `from '../apiClient'` (file doesn't exist there)
- `src/services/apiClient.ts` — axios, reads from **localStorage** ❌ security violation (PHI data)
- `src/services/client.ts` — axios, reads from **localStorage + sessionStorage** ❌ PHI violation

Pages using `from '../services/apiClient'` get the broken re-export → 404 crash at runtime.  
**Fix:** Delete `services/apiClient.js`, `services/apiClient.ts`, `services/client.ts`. All pages must use `lib/apiClient.js`.

### 🔴 BUG 4 — Missing Layout / Sidebar — no navigation between pages
App.jsx has no Layout wrapper. Every protected route renders a page in isolation with no sidebar, no nav.  
User logs in → sees OverviewDashboard but has NO WAY to navigate to hospitals, IAM, alerts, etc.  
`OverviewDashboard` calls `onNavigate(item.view)` but that prop is never passed.  
**Fix:** Add a `Layout.jsx` with sidebar and wrap all protected routes.

### 🔴 BUG 5 — OverviewDashboard `onNavigate` prop never wired
`OverviewDashboard` has quick-action buttons that call `onNavigate('iam')`, `onNavigate('hospitals')` etc.  
In App.jsx it's rendered as `<OverviewDashboard />` — no `onNavigate` prop passed. All clicks are no-ops.  
**Fix:** Pass `useNavigate()` handler as `onNavigate` prop.

### 🔴 BUG 6 — HospitalDetail, VerificationDetail use `onBack` prop never passed
Both are lazy-loaded routes with `onBack` props, but App.jsx renders them as plain routes with no props.  
Clicking the back button throws "onBack is not a function".  
**Fix:** Use `useNavigate(-1)` internally instead of relying on a prop.

### 🔴 BUG 7 — HospitalNetwork calls `onViewHospital(h.id)` — prop never passed
`HospitalNetwork` uses `onViewHospital` prop which is never passed from App.jsx.  
"Deep View" button silently does nothing.  
**Fix:** Use `useNavigate('/hospitals/' + h.id)` internally.

### 🔴 BUG 8 — HospitalDetail, StaffPerformance, OverviewDashboard, OperationalGovernanceDashboard use `localStorage.getItem('token')`
These 4 pages call `localStorage.getItem('token')` directly — bypassing the in-memory tokenStore.  
Token is never in localStorage (that's the whole point — PHI security). All API calls return 401.  
**Fix:** Import `{ tokenStore }` from `lib/apiClient` and use `tokenStore.get()`.

### 🔴 BUG 9 — VerificationDetail uses `localStorage.getItem('token')` + raw axios
Same PHI violation. Uses raw axios instead of the shared api client.  
**Fix:** Use `api` from `lib/apiClient`.

### 🔴 BUG 10 — AdminDashboard, LabManager, NurseVitals import from `'../apiClient'` (wrong path)
These 3 pages: `import apiClient from '../apiClient'`  
That path resolves to `src/apiClient.js` — **file does not exist**. Instant crash on load.  
**Fix:** Change to `import { api } from '../lib/apiClient'`

### 🔴 BUG 11 — `services/apiClient.js` broken re-export
`export { default } from '../apiClient'` — the file `src/apiClient.js` does not exist.  
Every page importing from `services/apiClient` crashes.  
**Fix:** Replace with proper re-export from `../lib/apiClient`.

### 🔴 BUG 12 — healthcare-core main.py: `partner_orders_router` used but never imported
`app/main.py` line: `app.include_router(partner_orders_router, ...)` — no import for it.  
Server crashes at startup with `NameError: name 'partner_orders_router' is not defined`.  
**Fix:** Add `from app.api.v1.partner_orders import router as partner_orders_router`

### 🔴 BUG 13 — healthcare-core router includes ALL routes under `/api/v1/healthcare/` prefix
But the frontend calls: `/api/v1/admin/...`, `/api/v1/hospitals`, `/api/v1/analytics/overview` etc.  
Backend exposes them under `/api/v1/healthcare/hospitals`, `/api/v1/healthcare/owner/dashboard` etc.  
**All super-admin API calls return 404.**  
**Fix:** Add a dedicated super-admin router under `/api/v1/admin/` with the correct endpoints.

### 🔴 BUG 14 — No `super_admin` role guard on any backend endpoint
Auth service creates tokens with roles: `"doctor"`, `"nurse"`, `"hospital_admin"`, `"admin"`.  
The value `"super_admin"` is never produced by the auth service.  
Frontend Login.jsx checks `data.user.role !== 'super_admin'` — always blocks entry.  
**Fix:** Add `super_admin` as a valid role in the auth service User model, and add a `require_role("super_admin")` guard to admin endpoints.

### 🔴 BUG 15 — `react-router-dom` not in package.json
`App.jsx`, `ProtectedRoute.jsx`, `VerificationQueue.jsx` all import from `react-router-dom`.  
It's not listed in package.json. `npm install` will not install it. App crashes.  
**Fix:** Add `"react-router-dom": "^6.26.0"` to dependencies.

### 🔴 BUG 16 — `zustand` not in package.json  
`authStore.js` uses `create` from `zustand`. Not in package.json.  
**Fix:** Add `"zustand": "^4.5.0"`.

### 🟡 BUG 17 — AuditLogViewer uses `keepPreviousData` (deprecated in TanStack Query v5)
`keepPreviousData: true` is v4 API. In v5 (installed: `^5.100.9`) use `placeholderData: keepPreviousData`.  
**Fix:** Replace with `import { keepPreviousData } from '@tanstack/react-query'` and use it as `placeholderData`.

### 🟡 BUG 18 — `.env` has `VITE_API_BASE_URL=http://localhost:8000` but HospitalDetail/OverviewDashboard/etc use `VITE_API_URL` (different var name)
`const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'`  
`VITE_API_URL` is never set — falls to hardcoded localhost. Fine in dev, wrong in production.  
**Fix:** Standardise all pages to use `VITE_API_BASE_URL` + `/api/v1` suffix from `lib/apiClient`.

### 🟡 BUG 19 — auth-service `.env` file has malformed REDIS_URL (missing `@host:port/db`)
`.env` has: `REDIS_URL=redis://:8pq2hWGH...`  (ends abruptly)  
Should be: `REDIS_URL=redis://:8pq2hWGH...@localhost:6379/0`  
**Fix:** Append `@localhost:6379/0` (or your Redis host).

### 🟡 BUG 20 — `ExportReports.jsx` dynamically imports `jspdf` + `jspdf-autotable` + `xlsx` but these packages aren't in package.json
Will fail at runtime with a module-not-found error.  
**Fix:** Add to package.json dependencies.

---

## MISSING BACKEND ENDPOINTS (frontend calls these, backend has none)

| Frontend Call | Backend Status |
|---|---|
| `GET /api/v1/admin/audit-logs` | ❌ MISSING |
| `GET /api/v1/admin/users` | ❌ MISSING |
| `POST /api/v1/admin/users` | ❌ MISSING |
| `PUT /api/v1/admin/users/:id/status` | ❌ MISSING |
| `DELETE /api/v1/admin/users/:id` | ❌ MISSING |
| `GET /api/v1/admin/alerts` | ❌ MISSING |
| `PATCH /api/v1/admin/alerts/:id/resolve` | ❌ MISSING |
| `POST /api/v1/doctor/emergency/broadcast` | ❌ MISSING (broadcast exists in doctor_stats_alerts.py but path differs) |
| `GET /api/v1/admin/revenue` | ❌ MISSING |
| `GET /api/v1/admin/hospitals` | ❌ MISSING (exists as `/api/v1/healthcare/hospitals` for `admin` role) |
| `GET /api/v1/analytics/overview` | ❌ MISSING |
| `GET /api/v1/admin/verification/:id` | ❌ MISSING |
| `POST /api/v1/admin/verification/:id/approve` | ❌ MISSING |
| `POST /api/v1/admin/verification/:id/reject` | ❌ MISSING |
| `GET /api/v1/hospitals/pending-verification` | ❌ MISSING |
| `PATCH /api/v1/hospitals/:id/verify` | ❌ MISSING |

**Solution:** Create `backend/healthcare-core/app/api/v1/super_admin.py` router with all these endpoints, mount at `/api/v1/admin`.

---

## SUMMARY OF FIXES DELIVERED

1. `super-admin-dashboard/package.json` — add `react-router-dom`, `zustand`, `jspdf`, `jspdf-autotable`, `xlsx`
2. `src/lib/apiClient.js` — already correct, no change
3. `src/services/apiClient.js` — fix broken re-export
4. `src/App.jsx` — add Layout, wire onNavigate, fix all route props
5. `src/components/Layout.jsx` — new sidebar + topbar
6. `src/pages/Login.jsx` — fix phone field key + role check
7. `src/pages/OverviewDashboard.jsx` — remove localStorage, use tokenStore, receive onNavigate via router
8. `src/pages/HospitalNetwork.jsx` — remove localStorage, use api client, internal navigate
9. `src/pages/HospitalDetail.jsx` — remove localStorage, use api client, internal back
10. `src/pages/StaffPerformance.jsx` — remove localStorage, use api client
11. `src/pages/OperationalGovernanceDashboard.jsx` — remove localStorage, use api client
12. `src/pages/VerificationDetail.jsx` — remove localStorage + raw axios, use api client
13. `src/pages/AdminDashboard.jsx` — fix import path
14. `src/pages/LabManager.jsx` — fix import path
15. `src/pages/NurseVitals.jsx` — fix import path
16. `src/pages/AuditLogViewer.jsx` — fix keepPreviousData
17. `backend/healthcare-core/app/main.py` — add missing partner_orders import
18. `backend/healthcare-core/app/api/v1/super_admin.py` — NEW: all missing admin endpoints
19. `backend/healthcare-core/app/api/router.py` — mount super_admin router at /admin
20. `backend/auth-service/app/api/v1/auth.py` — fix login to accept phone_number field, add super_admin role
21. `.env` files — document correct structure
