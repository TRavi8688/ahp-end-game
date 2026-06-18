# Hospyn Super Admin — Drop-In Fix Guide

## How to apply these fixes (5 minutes)

### Step 1 — Frontend: super-admin-dashboard/

| Fixed file | Action |
|---|---|
| `package.json` | Replace — adds react-router-dom, zustand, jspdf, xlsx |
| `src/App.jsx` | Replace — adds Layout, wires all routes |
| `src/components/Layout.jsx` | **NEW FILE** — sidebar navigation shell |
| `src/components/ProtectedRoute.jsx` | Replace — uses react-router Navigate |
| `src/lib/apiClient.js` | Replace — exports tokenStore for authStore |
| `src/stores/authStore.js` | Replace — uses tokenStore (no localStorage) |
| `src/services/apiClient.js` | Replace — was broken re-export, now works |
| `src/pages/Login.jsx` | Replace — sends correct phone field |
| `src/pages/OverviewDashboard.jsx` | Replace — no localStorage, wired nav |
| `src/pages/HospitalNetwork.jsx` | Replace — no localStorage, internal navigate |
| `src/pages/HospitalDetail.jsx` | Replace — uses useParams, no localStorage |
| `src/pages/VerificationDetail.jsx` | Replace — uses useParams, no localStorage |
| `src/pages/StaffPerformance.jsx` | Replace — no axios/localStorage |
| `src/pages/OperationalGovernanceDashboard.jsx` | Replace — no axios/localStorage |
| `src/pages/AuditLogViewer.jsx` | Replace — TanStack v5 keepPreviousData fix |
| `src/pages/Unauthorized.jsx` | **NEW FILE** — needed by ProtectedRoute |

After copying files:
```bash
cd super-admin-dashboard
npm install        # installs the 4 missing packages
npm run dev
```

### Step 2 — Backend: healthcare-core/

| Fixed file | Action |
|---|---|
| `app/main.py` | Replace — fixes partner_orders import crash + mounts /api/v1/admin |
| `app/api/router.py` | Replace — includes super_admin router |
| `app/api/v1/super_admin.py` | **NEW FILE** — all 16 missing admin endpoints |
| `app/core/security.py` | Replace — adds "super_admin" to role Literal |

### Step 3 — Auth service: auth-service/

| Fixed file | Action |
|---|---|
| `app/api/v1/auth.py` | Replace — accepts phone_number key in login body |

### Step 4 — Environment files

See `.env.reference` for correct values.

Critical fix: `REDIS_URL` in auth-service `.env` was truncated — must be:
```
REDIS_URL=redis://:your_redis_password@localhost:6379/0
```

Frontend `.env`:
```
VITE_API_BASE_URL=http://localhost:8000
```
(was `VITE_API_URL` in some pages — now standardised)

### Step 5 — Create a super_admin user

Run this once in your DB to create your first super admin account:
```sql
INSERT INTO users (id, full_name, phone_number, role, is_active, created_at)
VALUES (gen_random_uuid(), 'Super Admin', '+91XXXXXXXXXX', 'super_admin', true, NOW());
```
Then set their password via your auth service or directly hash + store.

---

## Data flow summary (end-to-end)

```
Login.jsx
  → POST /api/v1/auth/login  { phone, password }   (auth-service)
  ← { access_token, user: { role: "super_admin" } }
  → tokenStore.set(token)  [in-memory, never localStorage]
  → authStore.login(user, token)
  → navigate('/')

Any page (e.g. HospitalNetwork)
  → api.get('/api/v1/admin/hospitals')
  → lib/apiClient adds Bearer header from tokenStore.get()
  → nginx routes to healthcare-core
  → main.py: super_admin_router at /api/v1/admin
  → require_role("super_admin") validates JWT via JWKS
  → DB query → response
  ← { data: [...hospitals] }

401 received anywhere
  → tokenStore.clear()
  → window.location = '/login'
```
