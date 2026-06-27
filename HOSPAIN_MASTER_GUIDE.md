# HOSPAIN — MASTER DEPLOYMENT & FIX GUIDE

**All documents merged. Zero information lost.**
**Date: June 26, 2026 | Status: Production-Ready**

---

> **HOW TO USE THIS DOCUMENT**
> This is the single source of truth. It merges four separate guides:
> 1. `HOSPAIN_COMPLETE_GUIDE.md` — hospain-v2-web + healthcare-core fixes
> 2. `FIXES_AND_DEPLOYMENT_GUIDE.md` — patient-app + backend (nginx/auth) fixes
> 3. `IMPLEMENTATION_GUIDE.md` — Matrix employee ID login system
> 4. `PRODUCTION_CHECKLIST.md` — env vars, migration commands, smoke tests
>
> Follow sections in order. Do not skip manual steps.

---

## PART 1 — WHAT THIS PROJECT IS

HOSPAIN is a hospital management SaaS platform for India.

**Stack:** React + Tailwind + Vite (frontend) / FastAPI + PostgreSQL (backend) / Firebase (chat)

**User types:**
- Hospital Owner → registers hospital, accesses Owner Dashboard
- Hospain Staff → internal team, accesses Hospain Internal Panel
- Super Admin → Hospain team lead, verifies hospitals, manages employees

**Product URLs:**
- Landing page: `hospain.in`
- Owner dashboard: `hospain.in/dashboard`
- Internal panel (Matrix): `hospain.in/hospain-internal`
- Patient walk-in: `hospain.in/register`

**Products / repos:**
- `hospain-v2-web` — main web frontend (landing + owner dashboard + internal panel)
- `matrix` — internal staff portal (employee login, HR tools)
- `auth-service` — FastAPI JWT auth backend
- `healthcare-core` — FastAPI main backend
- `doctor-app` — React Native doctor-facing app
- `patient-app` — React Native patient-facing app
- `partner-app` — React Native lab/pharmacy partner app
- `staff-portal` — staff web portal

---

## PART 2 — COMPLETE BUG LIST (ALL PRODUCTS)

### 2.1 hospain-v2-web bugs (11 bugs)

| # | File | Severity | Description & Fix |
|---|------|----------|-------------------|
| BUG-1 | `src/App.jsx` → `saveSession()` | HIGH | **Branches never saved after login.** `if (branches)` skipped empty string `""` → `hospain_branches` never written → branch selector always empty. **Fix:** `if (branches !== undefined && branches !== null)` + always stringify before storing. |
| BUG-2 | `src/App.jsx`, `src/lib/api.js`, `src/pages/OwnerDashboard.jsx`, `src/components/SovereignConsole.jsx` | HIGH | **Owner JWT in localStorage (PHI security risk).** localStorage persists forever across tab close/restart — XSS readable. **Fix:** Token moved to sessionStorage. Non-sensitive labels (org name, email, branches) stay in localStorage. |
| BUG-3 | `src/components/SovereignConsole.jsx` | HIGH | **SovereignConsole still reading token from localStorage** after BUG-2 fix. **Fix:** `localStorage.getItem('hospain_owner_token')` → `sessionStorage.getItem('hospain_owner_token')`. |
| BUG-4 | `src/components/ActivationWizard.jsx` | HIGH | **Registration wizard blocked users** — only 2 steps, no document upload, no clear path. **Fix:** Full rewrite to 4-step wizard: (1) Hospital Details, (2) Documents (photo/PAN/license — all optional), (3) Phone OTP + Email OTP, (4) Submitted summary. Documents never block entry. |
| BUG-5 | `healthcare-core/app/api/v1/onboarding_simple.py` | HIGH | **No document upload endpoint** in the simple onboarding flow. **Fix:** Added `POST /onboarding/upload-documents/{hospital_id}`. Dev mode logs + stores dev path. Prod mode uploads to GCS. Inserts into `hospital_documents` table. Upload failure never blocks OTP. |
| BUG-6 | `src/pages/MarketingLanding.jsx` | MEDIUM | **Stats showed fake numbers as current facts** (legal risk — IT Act). **Fix:** Disclaimer added below stats: figures are 2028 targets, not current. CTA updated to "Be among the first verified hospitals." |
| BUG-7 | ALL 17 source files + `index.html` | HIGH | **Wrong brand name throughout** — "Hospyn" and "Hospin" used inconsistently everywhere (display text, storage keys, Firebase paths, email addresses, component filenames). **Fix:** Global rename: Hospyn/Hospin → Hospain everywhere. Storage keys, Firebase paths, file names all updated (see full key mapping in Section 3). |
| BUG-8 | `src/assets/logo.png` | LOW | **Old Hospyn logo still in place.** Fix: Replaced with new HOSPAIN logo (dark navy, arrow mark, "CARE BEYOND TODAY"). |
| BUG-9 | `src/pages/MarketingLanding.jsx`, `src/assets/hero_bg.png` | LOW | **Hero section showed placeholder grey gradient.** Fix: hero_bg.png placed in assets. Hero rebuilt with full-bleed background image, white-to-transparent overlay on left for text readability. |
| BUG-10 | `src/pages/OwnerDashboard.jsx` | HIGH | **5 placeholder "Coming Soon" tabs** (Lab, OPD, AI Governance, Chitti AI, Alerts). **Fix:** All 5 fully implemented with live endpoints (see Section 5 for detail). |
| BUG-11 | `src/pages/HospainInternalPanel.jsx` | HIGH | **No document viewer for super-admin** — hospitals submitted PAN/photos/licenses but super-admin had no UI to view or action them. **Fix:** New "Verify Hospitals" tab added (super_admin only) with list view, detail view (inline docs + fraud signals + checklist), and Approve / Reject / Request Info actions. |

---

### 2.2 auth-service bugs (10 bugs)

> **Overall score before fixes: 52% → after fixes: 100%** (per backend audit report)

| ID | Severity | File | Description & Fix |
|----|----------|------|-------------------|
| BUG-1 | HIGH | `app/config/settings.py` | `JWT_ALGORITHM` was `HS256` → changed to `RS256`. |
| BUG-2 | 🔴 CRITICAL | `app/middleware/rbac.py` | **JWT library conflict — most dangerous bug, affected every authenticated request.** `auth-service` signed tokens with PyJWT (RS256), but `rbac.py` imported `JWTError` from `python-jose` — a different package. Errors propagated uncaught; every 401 was potentially swallowed silently. **Fix:** Replaced with `import jwt as pyjwt` + `except pyjwt.PyJWTError`. Removed `python-jose` from `requirements.txt` entirely. |
| BUG-3 | 🟠 HIGH | `app/middleware/rbac.py` (auth + hc-core) | JWT claim key `hid` → `hospital_id`. RBAC read `hid`, JWT wrote `hospital_id` → hospital_id always empty → all ABAC hospital scoping completely broken. |
| BUG-4 | 🟠 HIGH | `app/middleware/rbac.py` (auth + hc-core) | JWT claim key `ver` → `token_version`. RBAC read `ver`, JWT wrote `token_version` → always 0 → token invalidation after password reset never worked. |
| BUG-5 | 🟠 HIGH | ENV VARS | Twilio/SMTP credentials empty → OTP always failed. Requires provisioning in GCP (see Part 8 Step 3). |
| BUG-6 | 🟠 HIGH | ENV VARS | RSA keys not set → new random key pair generated on every restart → all sessions invalidated on deploy. **`JWT_PRIVATE_KEY_PEM` and `JWT_PUBLIC_KEY_PEM` are MISSING from GitHub Secrets** — must be generated and added (see Part 8 Step 2). |
| BUG-7 | 🟠 HIGH | `app/core/security.py` | JWKS endpoint crash: `pub_key.public_key().public_numbers()` called on already-public key → `AttributeError` on every call. **Fix:** `pub_key.public_numbers()` directly. |
| BUG-8 | 🟡 MEDIUM | `app/api/v1/auth.py` | `/run-auth-migrations` endpoint was fully public — anyone on the internet could trigger DDL schema mutations on the production database. **Fix:** Added `Depends(get_current_user)` + explicit superadmin role check → 403 for everyone else. |
| BUG-9 | 🟡 MEDIUM | `app/api/v1/auth.py` + `app/api/v1/internal_auth.py` | **6 auth flows + change-password called `db.flush()` with no `db.commit()`** — data silently lost on connection drop or rollback. The 7 broken flows: register (new user), register (resume unverified), send-otp, verify-otp (mark verified), verify-otp (auto-create user), set-password, internal_auth change-password. **Fix:** `await db.commit()` added after every `await db.flush()` in all 7 flows. |
| BUG-10 | 🟡 MEDIUM | `app/services/auth_service.py` | OTP plaintext written to logs in dev: `'OTP code would have been: {otp_code}'`. If log aggregation enabled in staging, OTP codes visible in logs. **Fix:** Removed. Log now says `'OTP value NOT logged for security'`. |
| BUG-11 | 🟡 MEDIUM | `app/api/v1/auth.py` | `GOOGLE_CLIENT_ID` hardcoded in source (`'625745217419-cq76...'`) — rotating credentials required a code push. **Fix:** Replaced with `os.environ.get('GOOGLE_CLIENT_ID')`. Returns 500 with clear message if not configured. |

---

### 2.2b healthcare-core bugs (5 bugs + 3 rebuilt endpoints)

| Severity | File | Description & Fix |
|----------|------|-------------------|
| 🟠 HIGH | `app/middleware/rbac.py` | Same `hid`/`ver` claim key bugs as auth-service. All ABAC hospital scoping broken for all clinical routes. Same fix applied: `hospital_id` + `token_version`. Removed `python-jose` from `healthcare-core/requirements.txt` too. |
| 🟠 HIGH | `app/api/v1/surgery.py` | **Was `501 Not Implemented` — entire Surgery model/table was missing.** Built from scratch: `Surgery` SQLAlchemy model (`models/surgery.py`), Alembic migration (`alembic/versions/010_surgery.py`), full CRUD router. See Part 5B for all endpoints. |
| 🟠 HIGH | `app/api/v1/lab_results.py` | **Was `501 Not Implemented`.** `LabOrder`/`LabOrderItem`/`LabTest` models already existed but were never exposed via any API. Built full implementation. See Part 5B for all endpoints. |
| 🟠 HIGH | `app/api/v1/consent.py` | **Was `501 Not Implemented`.** `ConsentRecord` and `DataDeletionRequest` models existed in `consent_stub.py` but were never wired up. Built full DPDP-compliant implementation. See Part 5B for all endpoints. |
| 🟡 MEDIUM | `app/models/__init__.py` | `LabTest`, `LabOrder`, `LabOrderItem`, `ConsentRecord`, `DataDeletionRequest`, `Surgery` were never registered with SQLAlchemy `Base.metadata` — Alembic autogenerate couldn't see them. **Fix:** All six added to `__init__.py`. |

---

### 2.3 Matrix frontend bugs (4 bugs)

| ID | Severity | File | Description & Fix |
|----|----------|------|-------------------|
| BUG-18 | 🟠 HIGH | `src/services/apiClient.js` | Dual API client return shapes were inconsistent → callers broke on one path or the other. **Fix:** Unified to consistent return shape. |
| BUG-19 | 🟡 MEDIUM | `src/pages/Login.jsx` | Role check used substring match → `"super_employee"` matched `"employee"`. **Fix:** Exact equality via `Set.has()`. |
| BUG-20 | 🟢 LOW | `src/pages/Login.jsx` | `'hospain_employee'` duplicated in `ALLOWED_ROLES`. Removed duplicate. |
| BUG-23 | 🟠 HIGH | `src/components/ProtectedRoute.jsx` | Auth stored in both `sessionStorage` AND `localStorage` → cross-tab stale state / new tab auth breakage. **Fix:** sessionStorage only. |

---

### 2.4 doctor-app bugs (5 bugs)

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| BUG-11 | 🔴 CRITICAL | 📄 PATCH | OTP send field name: `identifier` → `phone`/`email` |
| BUG-12 | 🔴 CRITICAL | 📄 PATCH | OTP login sends wrong field |
| BUG-13 | 🔴 CRITICAL | 📄 PATCH | Dual-storage auth gate breaks new tabs |
| BUG-14 | 🟠 HIGH | 📄 PATCH | `useAuthStore` dead code |
| BUG-15 | 🟡 MEDIUM | ✅ backend fixed | Legacy router registration |

---

### 2.5 patient-app bugs (8 bugs)

| ID | Severity | File | Description & Fix |
|----|----------|------|-------------------|
| BUG-24 | 🔴 CRITICAL | `src/screens/LoginScreen.js` | Hospyn ID prefix check: `startsWith('Hospyn-')` vs actual prefix `'HOSPYN-'` (case mismatch). **Fix:** Corrected to uppercase. |
| BUG-25 | 🔴 CRITICAL | backend `nginx/nginx.conf` | Wrong `/healthcare` path for patient login + missing gateway rewrite rules for 8 API paths. **This was the single biggest hidden bug** — profile, appointments, doctors, prescriptions, tickets all 404'd at the nginx gateway even though backend routes were fine. **Fix:** Added rewrite rules for `/api/v1/patients/`, `/api/v1/appointments/`, `/api/v1/doctors/`, `/api/v1/clinical/`, `/api/v1/prescriptions/`, `/api/v1/tickets/`, `/api/v1/walkin/`, `/api/v1/lab_results/`. |
| BUG-26 | 🟠 HIGH | `src/screens/LoginScreen.js` | Social login stub with no backend wiring. Fix: "Sign Up with Google" now routes to the existing working Google login flow (same backend endpoint auto-creates account on first use). |
| BUG-27 | 🟡 MEDIUM | `src/api.js` | Request interceptor was an empty stub — no token attached to outgoing requests. **Fix:** Now reads token from `SecurityUtils.getToken()` and attaches to all requests. |
| BUG-28 | 🟡 MEDIUM | `src/screens/LoginScreen.js` | **#1 root cause of "random login failures":** `navigation.replace('Home')` called after successful login but 'Home' doesn't exist at that nav level — error caught and shown as "Invalid credentials" even though login succeeded. **Fix:** Removed erroneous navigation call. |
| BUG-29-billing | 🟠 HIGH | `src/screens/BillingScreen.js` | Token/patient-ID read from AsyncStorage keys that nothing ever wrote to (`access_token`, `patient_id`). Also hardcoded `localhost:8000` fallback. **Fix:** Now uses `SecurityUtils.getToken()` + real patient profile ID + shared `API_BASE_URL`. |
| BUG-30-billing | 🟠 HIGH | `src/services/billingService.js` | `getInvoices()` called nonexistent endpoint. `getInvoiceDetail()` called plural form. `payInvoice()` directly marked payment as paid — security bug (no real money movement). **Fix:** Corrected all endpoints. `payInvoice()` replaced with `getUpiPaymentLink()` → `/billing/invoice/{id}/upi-url`. |
| BUG-31-clinical | 🟡 MEDIUM | `src/services/clinicalService.js` | Multiple calls pointed at wrong endpoints or pharmacist-only endpoints (always 403 for patient). **Fix:** Corrected paths. Missing backend features now fail with clear error message instead of silent 404. |

---

### 2.6 partner-app bugs (14 bugs — fully fixed, v2 report)

> All fixes cross-checked against actual backend source code. Every endpoint verified to exist.

| ID | Severity | File | Description & Fix |
|----|----------|------|-------------------|
| PA-1 | 🔴 CRITICAL | `src/services/apiClient.js` | **`/healthcare` prefix missing on ALL API calls.** nginx routes `/api/v1/healthcare/*` → `healthcare-core:8002`. Every pharmacy/staff/orders/walkin call was 404ing. Auth calls are different — nginx routes `/api/v1/auth/*` → `auth-service:8001` (no `/healthcare` prefix). **Fix:** Interceptor now adds `/healthcare` to all non-auth, non-onboarding calls automatically. |
| PA-2 | 🔴 CRITICAL | `src/pages/Login.jsx` | **Wrong role names — roles didn't exist in backend RoleEnum.** App allowed `'partner'`, `'pharmacy_owner'`, `'pharmacy_staff'` — none exist in `user.py` RoleEnum, never issued by backend → every user got 403 on every pharmacy endpoint. Backend actually uses `PHARMACY_ROLES = ("pharmacist", "admin", "hospital_admin", "owner")`. **Fix:** `ALLOWED_ROLES` updated to exactly match backend. |
| PA-3 | 🔴 CRITICAL | `src/services/apiClient.js`, `src/pages/Login.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Profile.jsx`, `src/pages/more/MoreSettings.jsx` | **Token stored in `localStorage` (GCP security violation / PHI risk).** **Fix:** All reads/writes moved to `sessionStorage` with key `hospyn_partner_token`. Clears on tab close. |
| PA-4 | 🔴 CRITICAL | `src/api.js`, `.env.production` | **Hardcoded wrong production URL** — typo (`hospAIn-...us-central1` instead of `hospyn-...asia-south1`) + hardcoded fallback in source. **Fix:** `.env.production` corrected to `https://hospyn-495906-api-625745217419.asia-south1.run.app/api/v1`. `api.js` now reads env var only, no hardcoded fallback. |
| PA-5 | 🔴 CRITICAL | `src/pages/WalkIn.jsx` | **Anonymous walk-in sale crashed with 400.** Backend `pharmacy_walkin.py` requires either `walkin_customer_id` or `patient_id` — neither `null`. "Skip" button passed `walkin_customer_id: null` → instant 400. **Fix:** Always create a walkin-customer record; use `'Walk-In Customer'` / `'0000000000'` as placeholders when no name/phone given. |
| PA-6 | 🔴 CRITICAL | `src/pages/WalkIn.jsx` | **Prescription upload called non-existent endpoint** (`/pharmacy/upload-prescription` not in any backend file; `CheckoutRequest` schema has no `prescription_image_url` field) → 404 blocked entire sale. **Fix:** Photo stored in memory for display only. Sales POST sends only fields `CheckoutRequest` actually accepts. Swap for real upload when backend adds the endpoint. |
| PA-7 | 🔴 CRITICAL | `src/pages/Profile.jsx`, `src/pages/more/MoreSettings.jsx` | **`/auth/me` not exposed via nginx** — `internal_auth.py` has `/me` but it's internal-only, not publicly routed → 404 on every profile load. **Fix:** Login now caches user info (`name`, `email`, `role`, `user_id`) from login response into `sessionStorage` as `hospyn_partner_user`. Profile/Settings reads from cache — no network call. |
| PA-8 | 🟠 HIGH | `src/pages/Register.jsx` | **Registration sent wrong field names** — none matched backend schema. `onboarding.py` accepts: `name`, `registration_number`, `owner_email`, `owner_password`, `phone_number`, `physical_address`, `pan_number`, `staff_count`, `payment_method_type`, `pan_card_photo`. App was sending: `owner_name`, `pan_holder_name`, `license_number`, `license_date` — all silently ignored, registration always failed. **Fix:** Form fields and field names rewritten to match backend exactly. |
| PA-9 | 🟡 HIGH | `src/pages/ForgotPassword.jsx` (NEW), `src/App.jsx` | **Forgot Password route missing — crash on click.** Login linked to `/forgot-password` but route didn't exist. Backend has `POST /api/v1/auth/forgot-password/request` ✅. **Fix:** Full ForgotPassword page created and route registered in App.jsx. |
| PA-10 | 🟡 MEDIUM | `src/pages/more/MoreSettings.jsx` | **Settings toggles reset on every reload.** `GET/PATCH /pharmacy/preferences` does not exist in backend yet — calls silently fail. **Fix:** Page now attempts load/save; failures are silent so rest of page works. Will work automatically when backend adds this endpoint. |
| PA-11 | 🟡 MEDIUM | `src/pages/more/MoreStaff.jsx` | **Staff page always 403 for pharmacist role.** Backend `staff.py` requires `hospital_admin`, `hospital_owner`, `admin`, `hr_manager`, or `owner` — `pharmacist` not included. **Fix:** Clear message shown: *"Staff management requires Hospital Admin or Owner access."* — not a generic error. |
| PA-12 | 🟠 MEDIUM | `src/pages/Dashboard.jsx` | **Manual auth headers set alongside interceptor** — duplicate/conflicting injection. **Fix:** Removed manual headers; interceptor handles everything. |
| PA-13 | 🟠 MEDIUM | `src/pages/Orders.jsx`, `Inventory.jsx`, `Suppliers.jsx`, `Finance.jsx`, `WalkIn.jsx` | **All 7 `alert()` calls replaced** with inline error state and shared `Toast` component. |
| PA-14 | 🟢 LOW | `package.json` | **Unused beta package** `react-qr-reader@3.0.0-beta-1` never imported anywhere. Removed. |

---

### 2.7 staff-portal bugs (13 bugs — fully fixed)

> Scope: Admin, Reception, Nurse, Owner, Lab, Support dashboards only.
> HR, Doctor, and Pharmacy dashboards deliberately excluded (separate apps).
> Verified clean: `tsc --noEmit` 0 errors · `eslint .` 0 errors · `vite build` succeeds · all 214 backend routes load · `alembic heads` exactly one head.

#### Backend bugs

| ID | Severity | File | Description & Fix |
|----|----------|------|-------------------|
| SP-B1 | 🔴 CRITICAL | `alembic/versions/008_enterprise_ticket_system.py` | **Broken migration chain** — `down_revision` pointed at `"007_queue_lab_support"` which doesn't exist anywhere. `alembic upgrade head` would fail completely from a fresh DB. **Fix:** Repointed at a new merge revision (SP-B2). |
| SP-B2 | 🔴 CRITICAL | `alembic/versions/0010_merge_heads.py` **(NEW)** | Two migration branches had diverged from a common ancestor and never merged → two Alembic heads. **Fix:** No-op merge migration joining both branches into one. |
| SP-B3 | 🔴 CRITICAL | `alembic/versions/0011_staff_table.py` **(NEW)** | **`staff` table had no migration at all.** The `Staff` model was used by Nurse, Reception, Owner, Lab, HR dashboards but the table never existed in a real DB. None of those modules could have worked in production. **Fix:** Migration created to exactly match existing `Staff` ORM model. |
| SP-B4 | 🔴 CRITICAL | `app/api/router.py` | `super_admin.py` (analytics, audit-logs, hospital verification) was fully built but **never imported or mounted** — all those routes were dead. `lab.py` didn't exist. **Fix:** Registered `super_admin_router` at `/admin`; built and registered new `lab_router` at `/lab`. |
| SP-B5 | 🔴 CRITICAL | `app/api/v1/lab.py` **(NEW)** | Lab dashboard called `/lab/orders`, `/lab/orders/{id}/results`, `/lab/upload-report` — **none of these existed** (only an unrelated `/lab_results/` placeholder did). **Fix:** Built full router against existing `LabOrder`/`LabOrderItem`/`LabTest` models: list/create orders, mark-sample-collected vs. finalize-results (same endpoint, branches on order state), report upload (reuses same GCS + file-validation utilities `patients.py` already uses). |
| SP-B6 | 🟠 HIGH | `app/api/v1/tickets.py` | `GET /tickets/{id}/messages` didn't exist — only `POST` (send) did. Support chat thread could never load history. **Fix:** Added GET endpoint reading from `ticket_messages`. |
| SP-B7 | 🟠 HIGH | `app/api/v1/appointments.py` | Three bugs: (1) No `/checkin` endpoint at all — Reception "Verify & Check In" button 404'd every time. (2) Non-patient/non-doctor roles (receptionist, nurse, lab) saw **every hospital's** appointments — no staff-hospital scoping. (3) Response never included patient/doctor names or phone — every row showed "Anonymous Patient" / "No Phone". **Fix:** Added `POST /{id}/checkin`. Scoped staff-role branch to caller's own hospital via their staff profile. Joined Patient/Doctor records to populate names. |
| SP-B8 | 🟡 MEDIUM | `app/schemas/appointment.py` | `AppointmentResponse` had no `patient_name`/`patient_phone`/`doctor_name`/`department` fields. **Fix:** Added all four as `Optional` with default `None` — safe for all existing callers. |
| SP-B9 | 🟠 HIGH | `app/api/v1/nurse.py` | `require_role("staff", "admin")` — real nurse JWTs carry role `"nurse"` not `"staff"` → every nurse login 403d on every nurse endpoint. **Fix:** Added `"nurse"` to allowed roles. |
| SP-B10 | 🟠 HIGH | `app/api/v1/reception.py` | Same issue — `require_role("staff", "admin", "hospital_admin")` missing `"receptionist"` → every receptionist login 403d. **Fix:** Added `"receptionist"`. |
| SP-B11 | 🔴 CRITICAL | `app/api/v1/owner.py` | `require_role("hospital_owner", ...)` — `"hospital_owner"` is not a real role anywhere in the system (real role is `"owner"`) → every owner login 403d on `/owner/dashboard`. **Fix:** Replaced `"hospital_owner"` with `"owner"`. |
| SP-B12 | 🟢 LOW | `app/api/v1/staff.py` | Dead `"hospital_owner"` string repeated 7 times alongside the correct `"owner"` — harmless but dead weight. **Fix:** Removed. |

#### Frontend bugs

| ID | Severity | File | Description & Fix |
|----|----------|------|-------------------|
| SP-F1 | 🟠 HIGH | `src/store/useStore.ts` | **PHI persisted to localStorage.** Patient alerts (names, zones, clinical flags) written to `localStorage` — survives tab/browser close, readable by anything with disk/browser access. **Fix:** Alerts in-memory only, no persistence. Non-PHI `systemStatus` moved to `sessionStorage`. |
| SP-F2 | 🟡 MEDIUM | `src/context/AuthContext.tsx` | Email vs. phone detection used `identifier.includes('@')` — copy-paste garbage with `@` in a phone number would misroute. **Fix:** Replaced with proper email-shape regex. |
| SP-F3 | 🟢 LOW | `src/pages/Login.tsx` | Footer claimed `RS256 / HS256` — only RS256 is used. Unused `user` variable. **Fix:** Text corrected; dead variable removed. |
| SP-F4 | 🟠 HIGH | `src/components/Layout.tsx` | Nav "Dashboard" link built as `` `/${role}` `` — worked for roles whose name exactly matched the route, broke for others. `receptionist` → `/receptionist` (real route is `/reception`). Role arrays used `pharmacy` instead of real role `pharmacist`. `hospital_admin`/`super_admin`/`staff` never in any array → those users saw no relevant nav items. **Fix:** Explicit role→path map for Dashboard link. All role arrays corrected to real JWT role strings matching `App.tsx`. |
| SP-F5 | 🔴 CRITICAL | `src/App.tsx` | Reception sidebar linked to `/reception/checkin`, `/reception/billing`, `/reception/queue`, `/reception/appointments` — **none of these routes existed**. All silently fell through to catch-all, re-rendering the main Reception dashboard no matter which link was clicked. `CheckInPage`, `BillingPage`, `QueueBoardPage`, `TodaysAppointmentsPage` were fully built but completely unreachable — dead code. Also: public walk-in self-registration page `WalkInPage.tsx` had no route → every scanned QR 404'd. **Fix:** Wired all four Reception sub-pages to real routes. Added public unauthenticated `/walkin/:signedToken` route. |
| SP-F6 | 🔴 CRITICAL | `src/pages/Dashboard/ReceptionDashboard.tsx` | "QR code" shown to patients was a **hardcoded decorative SVG path** — didn't encode any token, never scannable. Also three `alert()` calls remaining while every other dashboard had moved to toasts. **Fix:** Installed `qrcode.react`, renders real QR encoding actual walk-in URL. `alert()` calls replaced with toast state. |
| SP-F7 | 🟡 MEDIUM | `src/pages/Dashboard/OwnerDashboard.tsx` | Three "Quick Actions" buttons (Revenue Report, Inventory, Settings) had **no `onClick` handler** — clicking did nothing silently. The underlying pages don't exist yet. **Fix:** Buttons marked `disabled` with "Coming Soon" label — UI is honest about what's actually built. |
| SP-F8 | 🟢 LOW | `src/pages/Dashboard/TodaysAppointmentsPage.tsx` | Unused `useAuth`/`user` import left from earlier version. **Fix:** Removed. |
| SP-F9 | 🟠 HIGH | `src/pages/Queue.tsx`, `src/pages/SetupWizard.tsx` | Both fully orphaned — not imported or routed from anywhere. Both called non-existent endpoints (`/queue`, `/hospital`) and used undefined CSS classes (`glass-card`, `btn-primary`). **Fix:** Deleted. (Not missing routes — genuinely dead weight.) |

#### Already verified correct — no changes needed
`NurseDashboard.tsx`, `SupportPage.tsx`, `BillingPage.tsx`, `CheckInPage.tsx`, `QueueBoardPage.tsx`, `InvoiceQRModal.tsx`, `WalkInPage.tsx`, `useWebSocket.ts`, `Unauthorized.tsx`, `ProtectedRoute.tsx` — every API call traced against actual backend route, payload shape, and response shape. All correct.

#### Flagged but deliberately NOT touched (out of scope)
- **HR, Doctor, Pharmacy dashboards/backends** — excluded, per scope (separate apps already being built).
- **Internal "Matrix"/"Mission Control" modules** (`matrix_mission.py`, `matrix_ops.py`, etc.) — also unregistered/unmounted, but these belong to the separate internal Hospain admin tool (Matrix), not staff-portal. Left alone.
- **`security_hardening.py`** — documentation/snippets meant to be hand-applied elsewhere, not an actual router. Not relevant to staff-portal.

---

### 2.8 New features delivered (all products)

| Feature | Product | Status |
|---------|---------|--------|
| Employee ID login system (6-char H+R format) | auth-service + matrix | ✅ |
| Forced password change on first login | matrix | ✅ |
| HR admin Employee Accounts creation tool | matrix | ✅ |
| `/api/v1/auth/employees/create` endpoint | auth-service | ✅ |
| `/api/v1/auth/change-password` endpoint | auth-service | ✅ |
| `/api/v1/auth/employees/validate-id/{id}` endpoint | auth-service | ✅ |
| Apple Sign-In backend (`POST /auth/apple`) | auth-service | ✅ |
| Multi-client Google OAuth (web + iOS + Android) | auth-service | ✅ |
| Doctor cards return `full_name`, `specialty`, `hospital_name` | healthcare-core | ✅ |
| Prescriptions scoped to requesting patient only (security) | healthcare-core | ✅ |
| Surgery scheduling — full CRUD (was 501) | healthcare-core | ✅ |
| Lab results — full implementation (was 501) | healthcare-core | ✅ |
| DPDP Consent management — full implementation (was 501) | healthcare-core | ✅ |
| Owner Dashboard: Lab, OPD, SLA, Chitti AI, Alerts tabs | hospain-v2-web | ✅ |
| Super-admin document verification panel | hospain-v2-web | ✅ |
| 4-step ActivationWizard with document upload | hospain-v2-web | ✅ |

---

## PART 3 — STORAGE KEY RENAMES (hospain-v2-web)

All storage keys renamed from old brand to new brand. **Any code still reading the old keys will get `null`.**

| Old key | New key | Storage |
|---------|---------|---------|
| `hospyn_owner_token` | `hospain_owner_token` | sessionStorage (moved from localStorage) |
| `hospyn_owner_email` | `hospain_owner_email` | localStorage |
| `hospyn_org_name` | `hospain_org_name` | localStorage |
| `hospyn_branches` | `hospain_branches` | localStorage |
| `hospyn_internal_token` | `hospain_internal_token` | localStorage |
| `hospyn_internal_email` | `hospain_internal_email` | localStorage |
| `hospyn_internal_empid` | `hospain_internal_empid` | localStorage |
| `hospyn_internal_level` | `hospain_internal_level` | localStorage |
| `hospyn_internal_team` | `hospain_internal_team` | localStorage |
| `hospyn_internal_name` | `hospain_internal_name` | localStorage |

Firebase path: `hospyn_tickets/{id}/messages` → `hospain_tickets/{id}/messages`

---

## PART 4 — COMPLETE FILE MAP (what changed vs untouched)

### 4.1 hospain-v2-web frontend

```
src/App.jsx                              CHANGED — branches bug, token→sessionStorage, no auto-login on register
src/lib/api.js                           CHANGED — getToken() reads sessionStorage first, added postMultipart()
src/assets/logo.png                      REPLACED — new Hospain logo
src/assets/hero_bg.png                   NEW FILE — hero section background image

src/pages/MarketingLanding.jsx           CHANGED — hero bg, stats disclaimer, CTA text, brand rename
src/pages/OwnerDashboard.jsx             CHANGED (major) — sessionStorage, 5 new tabs, button renames
src/pages/HospainInternalPanel.jsx       CHANGED + RENAMED (was HospynInternalPanel.jsx)
                                           — VerificationPanel component, "Verify Hospitals" tab
src/pages/PrivacyPolicy.jsx              CHANGED — brand rename only
src/pages/TermsOfService.jsx             CHANGED — brand rename only
src/pages/Network.jsx                    CHANGED — brand rename only
src/pages/Vision.jsx                     CHANGED — brand rename only
src/pages/Home.jsx                       CHANGED — brand rename only
src/pages/Platform.jsx                   UNTOUCHED

src/components/ActivationWizard.jsx      CHANGED (full rewrite) — 4-step wizard, doc upload, dual OTP
src/components/Modals.jsx                CHANGED — brand rename only
src/components/Navbar.jsx                CHANGED — brand rename only
src/components/QuickRegister.jsx         CHANGED — brand rename only
src/components/ErrorBoundary.jsx         CHANGED — brand rename only
src/components/SovereignConsole.jsx      CHANGED — sessionStorage token fix + brand rename
src/components/ticket/TicketSystem.jsx   CHANGED — Firebase path rename + brand rename

index.html                               CHANGED — domain, meta, OG, Twitter cards, schema.org → hospain.in
```

### 4.2 healthcare-core backend

```
app/api/v1/onboarding_simple.py          CHANGED — new POST /onboarding/upload-documents/{id} endpoint
app/api/v1/doctors.py                    CHANGED — GET /doctors/ now returns full_name, specialty, hospital_name
app/api/v1/prescriptions.py              CHANGED — prescriptions now scoped to requesting patient only
app/api/v1/lab_results.py               REBUILT — full lab results (was 501): test catalog, orders, status, enter results
app/api/v1/consent.py                   REBUILT — full DPDP consent (was 501): records, revoke, data deletion requests
app/api/v1/surgery.py                   REBUILT — full surgery scheduling (was 501): CRUD, status, OT room, surgeon/anesthetist
app/models/surgery.py                   NEW — Surgery SQLAlchemy model
app/models/__init__.py                  CHANGED — registered Lab, Consent, Surgery models with SQLAlchemy Base.metadata
app/middleware/rbac.py                  CHANGED — same hid→hospital_id + ver→token_version fixes as auth-service
alembic/versions/010_surgery.py         NEW — creates surgeries table with indexes
app/.env                                CHANGED — AUTH_JWKS_URL variable name fixed
requirements.txt                        CHANGED — removed python-jose
```

**Note on `app/middleware/rbac.py`:** This file IS wired into healthcare-core routes (unlike the old dead code note in earlier analysis — that referred to a different version). The fixes here are live and required.

### 4.2b healthcare-core backend — staff-portal additions (Admin, Reception, Nurse, Owner, Lab, Support)

```
alembic/versions/008_enterprise_ticket_system.py  CHANGED — down_revision repointed at 0010_merge_heads (was pointing at a nonexistent revision id)
alembic/versions/0010_merge_heads.py    NEW — no-op merge migration joining two diverged branches into one head
alembic/versions/0011_staff_table.py    NEW — creates the staff table (used by Nurse/Reception/Owner/Lab/HR; had no migration at all before)
app/api/router.py                       CHANGED — registered super_admin_router at /admin, registered new lab_router at /lab
app/api/v1/lab.py                       NEW — full lab router: list/create orders, mark-sample-collected vs. finalize-results, report upload
app/api/v1/tickets.py                   CHANGED — added GET /tickets/{id}/messages (only POST existed before)
app/api/v1/appointments.py              CHANGED — added POST /{id}/checkin; scoped staff-role branch to caller's own hospital; joined Patient/Doctor for names/phone
app/schemas/appointment.py              CHANGED — added patient_name, patient_phone, doctor_name, department as Optional fields
app/api/v1/nurse.py                     CHANGED — require_role(...) now includes "nurse" (was 403ing every real nurse login)
app/api/v1/reception.py                 CHANGED — require_role(...) now includes "receptionist" (was 403ing every real receptionist login)
app/api/v1/owner.py                     CHANGED — "hospital_owner" → "owner" (real role name); was 403ing every owner login
app/api/v1/staff.py                     CHANGED — removed dead duplicate "hospital_owner" string (cleanup, no functional change)
```

> **Verified clean before delivery:** `tsc --noEmit` 0 errors · `eslint .` 0 errors · `vite build` succeeds · full backend router import (`app.api.router`) loads all 214 routes with no import errors · `alembic heads` exactly one head (was broken before).

### 4.3 auth-service backend

```
app/models/user.py                       CHANGED — added employee_id, is_temporary_password columns; Hospain roles to RoleEnum
app/api/v1/auth.py                       CHANGED — employee_id login, change-password, employee create endpoints; db.commit() fixes; migration secured with superadmin check; Google client ID → env var
app/api/v1/internal_auth.py             CHANGED — db.commit() added to change-password endpoint
app/middleware/rbac.py                   CHANGED — PyJWT fix, hospital_id/token_version claim keys, exact role check, employee_id + must_change_password in CurrentUser
app/core/security.py                     CHANGED — JWKS pub_key.public_numbers() fix
app/services/auth_service.py            CHANGED — generate_employee_id(), generate_temp_password(), OTP log fix; added Apple JWKS verification
app/config/settings.py                  CHANGED — JWT_ALGORITHM HS256→RS256; added GOOGLE_CLIENT_ID_IOS, GOOGLE_CLIENT_ID_ANDROID, APPLE_BUNDLE_ID
app/.env                                CHANGED — added new OAuth client ID settings
requirements.txt                        CHANGED — removed python-jose; added twilio==8.12.0
alembic/versions/003_employee_id_temp_password.py  NEW — migration for employee_id + is_temporary_password + Hospain internal roles
```

### 4.4 Matrix frontend

```
src/pages/Login.jsx                      CHANGED — Employee ID login, exact role check, error detection fix, duplicate role removed
src/pages/ChangePassword.jsx             NEW — forced + voluntary password change with live validation
src/pages/matrix/EmployeeAccounts.jsx    NEW — HR tool: create employee, generate ID + temp password
src/components/ProtectedRoute.jsx        CHANGED — must_change_password intercept; sessionStorage only
src/stores/authStore.js                  CHANGED — stores must_change_password in session
src/services/apiClient.js               CHANGED — BUG-18 fix: consistent return shape
src/App.jsx                             CHANGED — new routes: /change-password, matrix/employee-accounts
```

### 4.5 nginx

```
nginx/nginx.conf                         CHANGED — added 8 missing gateway rewrite rules for patient-app API paths
```

### 4.6 patient-app (React Native)

**Changed files:**
```
App.js                          — Removed dead screen imports/registrations
src/api.js                      — Request interceptor now attaches auth token
src/screens/LoginScreen.js      — HOSPYN-ID prefix fix, removed bad navigation.replace('Home')
src/screens/RegisterScreen.js   — Google sign-up now routes to working Google login flow
src/screens/BookAppointmentScreen.js — Slot list replaced (no backend), correct booking fields
src/screens/BillingScreen.js    — Reads real token + patient ID, uses shared API_BASE_URL
src/services/billingService.js  — All endpoints corrected; payInvoice→getUpiPaymentLink
src/services/clinicalService.js — Endpoint paths corrected; missing features fail clearly
src/services/patientService.js  — getAppointments() calls correct /appointments/ endpoint
```

**Deleted (dead code, nothing ever navigated to them):**
```
src/screens/AuthScreen.js              — never imported (real login is LoginScreen.js)
src/screens/SplashScreen.js            — not registered anywhere
src/screens/OnboardingScreen.js        — registered but unreachable
src/screens/ProfileSetupScreen.js      — registered but unreachable
src/screens/MedicalHistoryScreen.js    — only reachable from dead ProfileSetupScreen
src/screens/CurrentMedicationsScreen.js — only reachable from dead MedicalHistoryScreen
src/screens/AppointmentBookingScreen.js — second unused booking screen (BookAppointmentScreen.js is real)
src/screens/InvoiceDetailScreen.js     — second unused invoice screen
```

**Safe to delete (flagged, not auto-deleted):**
```
components_ai_backup/          — backup copy of CircularProgress.js, unreferenced
navigation_ai_backup/          — backup copy of MainTabs.js, unreferenced
screens_ai_backup/             — ~20 old screen versions including old AuthScreen.js, all unreferenced
web-build/                     — stale compiled bundle; add to .gitignore
```

### 4.7 partner-app (React web — pharmacy/partner portal)

**Files to REPLACE:**
```
src/services/apiClient.js           — /healthcare prefix interceptor, sessionStorage token, no duplicate headers
src/api.js                          — env var only URL, no hardcoded fallback
src/App.jsx                         — ForgotPassword route added
src/pages/Login.jsx                 — correct ALLOWED_ROLES matching backend RoleEnum, sessionStorage token, user cache
src/pages/Register.jsx              — field names rewritten to match backend onboarding.py schema exactly
src/pages/Orders.jsx                — alert() → Toast
src/pages/WalkIn.jsx                — anonymous walk-in fix, removed non-existent upload endpoint
src/pages/Dashboard.jsx             — removed manual auth headers (interceptor handles)
src/pages/Profile.jsx               — reads user from sessionStorage cache (no /auth/me call)
src/pages/Inventory.jsx             — alert() → Toast
src/pages/more/MoreSettings.jsx     — sessionStorage token, silent failure for missing /pharmacy/preferences
src/pages/more/MoreStaff.jsx        — clear 403 message for pharmacist role
src/pages/more/MoreSuppliers.jsx    — alert() → Toast
src/pages/more/MoreFinance.jsx      — alert() → Toast
.env.production                     — corrected URL: hospyn-...asia-south1.run.app/api/v1
package.json                        — removed react-qr-reader@3.0.0-beta-1
```

**Files to CREATE (new files):**
```
src/pages/ForgotPassword.jsx        — NEW: forgot password page (backend endpoint exists)
src/components/Toast.jsx            — NEW: shared toast notification component
```

### 4.8 staff-portal frontend (Admin, Reception, Nurse, Owner, Lab, Support)

**Files to REPLACE:**
```
src/store/useStore.ts                    — PHI alerts no longer persisted to localStorage (in-memory only); systemStatus moved to sessionStorage
src/context/AuthContext.tsx              — email vs. phone detection now uses a real email-shape regex (was identifier.includes('@'))
src/pages/Login.tsx                      — footer text corrected (RS256 only, not RS256/HS256); removed unused `user` variable
src/components/Layout.tsx                — explicit role→path map for Dashboard link; role arrays corrected to real JWT role strings (pharmacist, hospital_admin, super_admin, staff, etc.)
src/App.tsx                              — wired /reception/checkin, /reception/billing, /reception/queue, /reception/appointments to real pages; added public /walkin/:signedToken route
src/pages/Dashboard/ReceptionDashboard.tsx — real scannable QR (qrcode.react) replacing fake decorative SVG; alert() calls replaced with toast state
src/pages/Dashboard/OwnerDashboard.tsx   — Quick Actions buttons (Revenue Report, Inventory, Settings) now disabled with "Coming Soon" label instead of doing nothing silently
src/pages/Dashboard/TodaysAppointmentsPage.tsx — removed unused useAuth/user import
package.json                             — added qrcode.react dependency
```

**Files DELETED (orphaned, unrouted, called nonexistent endpoints):**
```
src/pages/Queue.tsx                      — not imported/routed anywhere; called nonexistent /queue endpoint; undefined CSS classes
src/pages/SetupWizard.tsx                — not imported/routed anywhere; called nonexistent /hospital endpoint; undefined CSS classes
```

**Already verified correct (no changes):**
```
NurseDashboard.tsx, SupportPage.tsx, BillingPage.tsx, CheckInPage.tsx,
QueueBoardPage.tsx, InvoiceQRModal.tsx, WalkInPage.tsx, useWebSocket.ts,
Unauthorized.tsx, ProtectedRoute.tsx
```

#### Flagged but deliberately NOT touched (out of scope)
- **HR, Doctor, Pharmacy dashboards/backends** — excluded, per scope (separate apps already being built).
- **Internal "Matrix"/"Mission Control" modules** (`matrix_mission.py`, `matrix_ops.py`, etc.) — also unregistered/unmounted, but these belong to the separate internal Hospain admin tool (Matrix), not staff-portal. Left alone.
- **`security_hardening.py`** — documentation/snippets meant to be hand-applied elsewhere, not an actual router. Not relevant to staff-portal.

---

## PART 5 — NEW FEATURE: EMPLOYEE ID SYSTEM (Matrix)

### How it works

**ID format:** Always 6 chars, always contains `H` and `R` (Hospain HR branding), mix of uppercase letters + digits, no ambiguous characters (no O/0 confusion). Examples:
```
H3RK9N   7HR2K4   4H9RK2   K2H9R7
```

### How employees get their ID

1. HR admin or Super Admin → Matrix → Workforce → Employee Accounts
2. Fills in name, email (optional), role
3. System generates unique Employee ID + temporary password
4. Admin shares ID + temp password with employee securely

### First login flow

```
Employee enters ID + temp password
         ↓
Login succeeds → API returns must_change_password: true
         ↓
Frontend forces redirect to /change-password (cannot navigate away)
         ↓
Employee sets permanent password (min 8 chars, 1 uppercase, 1 number)
         ↓
New session token issued → Redirected to Command Center
```

Employees can also change password any time from Settings → Change Password. Changing password bumps `token_version` → all old sessions invalidated.

### New API endpoints

```
POST /api/v1/auth/employees/create            — admin/hr only; returns employee_id + temp_password
POST /api/v1/auth/change-password             — changes password, returns fresh token
GET  /api/v1/auth/employees/validate-id/{id}  — validates Employee ID exists (for UX)
```

---

## PART 5B — NEW CLINICAL ENDPOINTS (healthcare-core, were all 501)

### Surgery — `/api/v1/surgery/`

No Surgery model, table, or implementation existed before. Built entirely from scratch.

| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/surgery/` | Schedule a surgery — patient, surgeon, anesthetist, OT room, procedure name, ICD-10 code, consent status, pre-op notes |
| GET | `/surgery/` | List surgeries — filterable by hospital, patient, status (SCHEDULED / IN_PROGRESS / COMPLETED / CANCELLED / POSTPONED) |
| GET | `/surgery/{id}` | Get full surgery detail including pre/post-op notes |
| PATCH | `/surgery/{id}` | Update status, notes, surgeon, anesthetist, OT room. Auto-sets `started_at`/`completed_at` when status changes. |
| DELETE | `/surgery/{id}` | Cancel surgery (sets `status=CANCELLED`). Cannot cancel a completed surgery. |

**⚠️ Run `alembic upgrade head` after deploy** — creates the `surgeries` table from migration `010_surgery.py`. Surgery endpoints fail with table-not-found errors until this runs.

---

### Lab Results — `/api/v1/lab_results/`

`LabOrder`, `LabOrderItem`, and `LabTest` models existed but were never exposed via any API.

| Method | Endpoint | What it does |
|--------|----------|--------------|
| GET | `/lab_results/tests` | Lab test catalog — list all orderable tests with codes, categories, prices, turnaround hours |
| POST | `/lab_results/orders` | Create a lab order for a patient with one or more tests |
| GET | `/lab_results/orders` | List lab orders — filterable by hospital, patient, status |
| GET | `/lab_results/orders/{id}` | Get full order with all line items and result values |
| PATCH | `/lab_results/orders/{id}/status` | Update order status: ORDERED → SAMPLE_COLLECTED → IN_PROGRESS → COMPLETED → CANCELLED |
| POST | `/lab_results/orders/{id}/results` | Enter results per test item — value, unit, reference range, status (NORMAL/ABNORMAL/CRITICAL), clinical remarks |
| GET | `/lab_results/` | List completed lab results only — filterable by patient |

**Note:** Lab and consent tables already exist from earlier migrations — no new migration needed for these.

---

### DPDP Consent — `/api/v1/consent/`

`ConsentRecord` and `DataDeletionRequest` models existed in `consent_stub.py` but were never wired up.

| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/consent/` | Record patient consent — type (data_sharing / treatment / marketing), granted/revoked, version, IP, user-agent |
| GET | `/consent/` | List consent records — filterable by patient, hospital, consent_type |
| GET | `/consent/{id}` | Get single consent record with full audit trail |
| POST | `/consent/{id}/revoke` | Revoke a specific consent record (sets `revoked_at`, `granted=False`) |
| POST | `/consent/deletion-requests` | Patient right-to-erasure request (DPDP Article 13) |
| GET | `/consent/deletion-requests` | List all deletion requests (admin/superadmin only) |
| PATCH | `/consent/deletion-requests/{id}` | Update deletion request status (pending → in_progress → completed) |

---

## PART 5C — db.commit() Problem Explained

Six auth flows + one change-password endpoint called `db.flush()` without ever calling `db.commit()`. This was silently losing data on any connection drop or exception.

| `db.flush()` | `db.commit()` |
|-------------|---------------|
| Sends SQL within the current transaction. Visible to other queries in the same session but **NOT durably written**. If connection drops, transaction rolls back, or exception occurs — data is **GONE**. | Commits transaction to disk. Data is now durable — survives connection drops, crashes, and restarts. **This is the only call that actually saves data permanently.** |

The 7 flows that were broken (now all fixed):

1. `register()` — new user: user row never durably saved
2. `register()` — resume unverified: password update lost on connection drop
3. `send-otp`: OTP record not committed → `verify-otp` finds no record → "OTP not found" error
4. `verify-otp` — mark verified: `phone_verified=True` lost → user stuck in unverified loop forever
5. `verify-otp` — auto-create user: new patient account lost on rollback
6. `set-password`: password, phone, `has_usable_password` all lost on connection drop
7. `internal_auth change-password`: password update never persisted

---

## PART 6 — OWNER DASHBOARD: NEW TABS (hospain-v2-web)

All 5 previously stubbed tabs are now fully implemented:

**Laboratory Tab** — Calls `GET /lab-results/`. If backend returns 501 (LabResult model not yet built), shows honest notice with empty state.

[... Rest of guide truncated from source ...]
