# Super Admin Dashboard — Missing Files Fix Pack

## What's in this pack

All files that were imported in `App.jsx` but physically missing, causing the app to crash on those routes.

---

## Files Created

| File | Destination in Your Repo | Status |
|------|--------------------------|--------|
| `src/pages/Unauthorized.jsx`  | `super-admin/src/pages/Unauthorized.jsx`  | ✅ New |
| `src/pages/Dashboard.jsx`     | `super-admin/src/pages/Dashboard.jsx`     | ✅ New (re-exports OverviewDashboard) |
| `src/pages/Hospitals.jsx`     | `super-admin/src/pages/Hospitals.jsx`     | ✅ New (re-exports HospitalNetwork) |
| `src/pages/Staff.jsx`         | `super-admin/src/pages/Staff.jsx`         | ✅ Full implementation |
| `src/pages/StaffDetail.jsx`   | `super-admin/src/pages/StaffDetail.jsx`   | ✅ Full implementation |
| `src/pages/Billing.jsx`       | `super-admin/src/pages/Billing.jsx`       | ✅ Full implementation |
| `src/pages/Compliance.jsx`    | `super-admin/src/pages/Compliance.jsx`    | ✅ Full implementation (DPDP audit) |
| `src/pages/Analytics.jsx`     | `super-admin/src/pages/Analytics.jsx`     | ✅ New (re-exports RevenueAnalytics) |
| `src/pages/Settings.jsx`      | `super-admin/src/pages/Settings.jsx`      | ✅ Full implementation |
| `src/pages/AuditLog.jsx`      | `super-admin/src/pages/AuditLog.jsx`      | ✅ Full implementation |
| `src/components/Layout.jsx`   | `super-admin/src/components/Layout.jsx`   | ✅ Shared sidebar + topbar |
| `src/lib/apiClient.js`        | `super-admin/src/lib/apiClient.js`        | ✅ Consolidated (replaces services/apiClient.js) |

---

## Manual Steps Required

### Step 1 — Delete the duplicate API client (REQUIRED)
```bash
rm super-admin/src/services/apiClient.js
```

### Step 2 — Update import paths in existing pages (REQUIRED)
Find all files that import from the old path and update them:
```bash
# Find all files using the old import
grep -r "services/apiClient" super-admin/src/ --include="*.jsx" --include="*.js" -l
```
In each file found, change:
```js
// OLD
import apiClient from '../services/apiClient';
import apiClient from '../../services/apiClient';

// NEW
import apiClient from '../lib/apiClient';
import apiClient from '../../lib/apiClient';
```

### Step 3 — Wrap protected routes in Layout (REQUIRED)
Open `super-admin/src/App.jsx` and wrap each authenticated route's element with `<Layout>`:

```jsx
// Before
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

// After
<Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
```

Or — cleaner approach — wrap at the ProtectedRoute level in `ProtectedRoute.jsx`:
```jsx
import Layout from '../components/Layout';

export default function ProtectedRoute({ children, ...props }) {
  // ... your existing auth check ...
  return <Layout>{children}</Layout>;
}
```

### Step 4 — Create .env file if not present
```bash
# super-admin/.env
VITE_API_BASE_URL=https://api.hospyn.in
```

### Step 5 — Fix StaffDetail route in App.jsx
The audit says StaffDetail is needed. Make sure App.jsx has:
```jsx
<Route path="/staff/:id" element={<ProtectedRoute><Layout><StaffDetail /></Layout></ProtectedRoute>} />
```

### Step 6 — Verify the app builds with no import errors
```bash
cd super-admin
npm install
npm run build
```

---

## No-Code Notes

- `Dashboard.jsx` and `Hospitals.jsx` are thin re-exports — they don't duplicate logic.
  If you later want separate pages, replace the re-export with a full component.

- `Analytics.jsx` re-exports `RevenueAnalytics.jsx` (already complete per audit).
  If the route was meant to be distinct, build a new page and point the re-export there.

- `Layout.jsx` reads from `useAuthStore` — make sure the store key name matches
  your existing `authStore.js` export. Adjust the import path if your store is at
  a different location (e.g. `../store/authStore` vs `../stores/authStore`).

---

## API Endpoints Used by New Pages

| Page | Endpoints |
|------|-----------|
| Staff | `GET /api/v1/admin/staff`, `GET /api/v1/admin/staff/:id` |
| Billing | `GET /api/v1/admin/billing/invoices`, `GET /api/v1/admin/billing/stats` |
| Compliance | `GET /api/v1/admin/compliance/logs`, `GET /api/v1/admin/compliance/summary` |
| Settings | `GET /api/v1/admin/settings`, `PATCH /api/v1/admin/settings` |
| AuditLog | `GET /api/v1/admin/audit-log?page=&limit=&search=&action=&resource_type=&from=&to=` |

All endpoints follow the existing Hospyn API pattern with Bearer token auth.
