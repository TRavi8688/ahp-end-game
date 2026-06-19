# HOSPYN — Phase 3 & 4 Apply Instructions

Generated: June 2026 | Based on HOSPYN_MVP_SOLUTION_MASTER.docx

---

## What's In This Package

| File | Apply To | What It Does |
|------|----------|--------------|
| `backend/healthcare-core/app/api/v1/doctor_extensions.py` | Create new file | Doctor stats, alerts, break, emergency, access-history |
| `backend/healthcare-core/app/api/v1/patient_extensions.py` | Create new file | Patient vitals, notifications, device-token |
| `backend/healthcare-core/app/api/v1/staff.py` | Create new file | HR Portal backend (staff list, shifts, leaves) |
| `backend/healthcare-core/app/api/v1/billing.py` | REPLACE existing | Full UPI billing, QR URL, mark-paid, PDF receipt |
| `backend/healthcare-core/app/api/v1/owner.py` | Create new file | Real owner dashboard (replaces mock_token_123) |
| `backend/healthcare-core/app/api/router.py` | REPLACE existing | Registers all new Phase 3 routes |
| `backend/healthcare-core/app/api/v1/security_hardening.py` | Reference only | Code snippets for Phase 4 security |
| `frontend/hr-portal/src/App.jsx` | REPLACE existing | HR Portal routing (3 real pages) |
| `frontend/hr-portal/src/pages/ShiftRoster.jsx` | Create new file | HR Shift Roster page |
| `frontend/hr-portal/src/pages/LeaveManagement.jsx` | Create new file | HR Leave Requests page |
| `frontend/doctor-app/src/services/doctorService.js` | Create new file | Doctor app API service |
| `frontend/doctor-app/src/pages/DoctorDashboard.jsx` | REPLACE existing | Fully wired doctor dashboard |
| `frontend/patient-app/src/screens/BillingScreen.js` | REPLACE existing | Patient billing with UPI QR |
| `frontend/reception-portal/src/pages/BillingView.jsx` | Create new file | Reception billing + Mark as Paid |
| `alembic/phase3_new_tables.py` | Copy to alembic/versions/ | New DB tables for Phase 3 features |
| `nginx.conf` | REPLACE existing | Production security headers |

---

## Step-by-Step Application

### BACKEND — Apply in this order

```bash
# From your repo root (ahp-end-game root)

# 1. Copy all new backend files
cp hospyn_phase3_4/backend/healthcare-core/app/api/v1/doctor_extensions.py \
   backend/healthcare-core/app/api/v1/doctor_extensions.py

cp hospyn_phase3_4/backend/healthcare-core/app/api/v1/patient_extensions.py \
   backend/healthcare-core/app/api/v1/patient_extensions.py

cp hospyn_phase3_4/backend/healthcare-core/app/api/v1/staff.py \
   backend/healthcare-core/app/api/v1/staff.py

cp hospyn_phase3_4/backend/healthcare-core/app/api/v1/billing.py \
   backend/healthcare-core/app/api/v1/billing.py

cp hospyn_phase3_4/backend/healthcare-core/app/api/v1/owner.py \
   backend/healthcare-core/app/api/v1/owner.py

# 2. Replace the router
cp hospyn_phase3_4/backend/healthcare-core/app/api/router.py \
   backend/healthcare-core/app/api/router.py

# 3. Install new requirements
echo "reportlab" >> backend/healthcare-core/requirements.txt
pip install reportlab --break-system-packages

# 4. Also make sure 'twilio' is in auth-service requirements
echo "twilio" >> backend/auth-service/requirements.txt
pip install twilio --break-system-packages
```

---

### DATABASE — Apply migration

```bash
# 1. Find current head
alembic heads

# 2. Edit alembic/phase3_new_tables.py:
#    Change: down_revision = "YOUR_CURRENT_HEAD"
#    To:     down_revision = "<the ID from alembic heads output>"

# 3. Copy migration to alembic versions
cp hospyn_phase3_4/alembic/phase3_new_tables.py \
   alembic/versions/phase3_new_tables.py

# 4. Apply
alembic upgrade head

# 5. Verify tables were created
psql $DATABASE_URL -c "\dt" | grep -E "device_tokens|emergency_alerts|staff_shifts|leave_requests"
```

> ⚠️ **MANUAL STEP**: You must set `down_revision` in `phase3_new_tables.py`
> to the output of `alembic heads` before running upgrade.

---

### FRONTEND — HR Portal

```bash
# Install router dependency
cd hr-portal
npm install react-router-dom

# Copy all HR files
cp ../hospyn_phase3_4/frontend/hr-portal/src/App.jsx src/App.jsx
mkdir -p src/pages src/components
cp ../hospyn_phase3_4/frontend/hr-portal/src/pages/ShiftRoster.jsx src/pages/ShiftRoster.jsx
cp ../hospyn_phase3_4/frontend/hr-portal/src/pages/LeaveManagement.jsx src/pages/LeaveManagement.jsx

# Copy StaffList.jsx from the phase4-8 package you already have
cp ../hospyn_phases_4_to_8/hospyn_phases_4_to_8/phase5_frontend/hr-portal/src/pages/StaffList.jsx \
   src/pages/StaffList.jsx

# Copy ErrorBoundary from phase4-8 package
cp ../hospyn_phases_4_to_8/hospyn_phases_4_to_8/phase5_frontend/hr-portal/src/components/ErrorBoundary.jsx \
   src/components/ErrorBoundary.jsx

cd ..
```

---

### FRONTEND — Doctor App

```bash
cd doctor-app

# Install Zustand (from phase 4-8 package)
npm install zustand

# Copy the Zustand auth store (from phase 4-8 package)
mkdir -p src/store src/services src/pages
cp ../hospyn_phases_4_to_8/hospyn_phases_4_to_8/phase5_frontend/doctor-app/src/store/useAuthStore.js \
   src/store/useAuthStore.js

# Copy the doctor service and dashboard from phase3_4
cp ../hospyn_phase3_4/frontend/doctor-app/src/services/doctorService.js src/services/doctorService.js
cp ../hospyn_phase3_4/frontend/doctor-app/src/pages/DoctorDashboard.jsx src/pages/DoctorDashboard.jsx

cd ..
```

> ⚠️ **MANUAL STEP**: In `DoctorDashboard.jsx`, update the import of `doctorService`
> to match your existing file structure. Also register `DoctorDashboard` in your
> React Router config if it isn't already.

---

### FRONTEND — Patient App

```bash
cd patient-app

# Install QR code library
npm install react-native-qrcode-svg

# Copy billing screen
mkdir -p src/screens
cp ../hospyn_phase3_4/frontend/patient-app/src/screens/BillingScreen.js src/screens/BillingScreen.js

# Copy AppointmentBookingScreen from phase 4-8 package
cp ../hospyn_phases_4_to_8/hospyn_phases_4_to_8/phase6_patient_app/src/screens/AppointmentBookingScreen.js \
   src/screens/AppointmentBookingScreen.js

# Copy notifications service from phase 4-8 package
mkdir -p src/services
cp ../hospyn_phases_4_to_8/hospyn_phases_4_to_8/phase6_patient_app/src/services/notifications.js \
   src/services/notifications.js

cd ..
```

> ⚠️ **MANUAL STEP**: Register `BillingScreen` and `BillingDetailScreen` in your
> React Navigation stack. Also register `AppointmentBookingScreen`.

---

### FRONTEND — Reception Portal

```bash
cd reception-portal

# Install QR code library
npm install qrcode.react

# Install react-router-dom if not already
npm install react-router-dom

# Copy billing view
mkdir -p src/pages
cp ../hospyn_phase3_4/frontend/reception-portal/src/pages/BillingView.jsx src/pages/BillingView.jsx

cd ..
```

> ⚠️ **MANUAL STEP**: Register `BillingView` in reception-portal router:
> ```jsx
> <Route path="/billing/:invoiceId" element={<BillingView />} />
> ```
> Also add a "Bill" button in the patient checkout flow that navigates to
> `/billing/:invoiceId` after the doctor marks the appointment complete.

---

### PHASE 4 — Security Hardening

These require manual edits to existing files. Open `security_hardening.py`
(in the package) and follow each SECTION:

| Section | File to Edit | What to Do |
|---------|-------------|------------|
| **A** | `backend/auth-service/app/main.py` | Add Redis startup health check in `startup_event` |
| **B** | `backend/auth-service/app/main.py` | Add `/health` endpoint |
| **C** | `backend/ai-service/app/main.py` | Add triage feature flag check |
| **D** | `backend/app/main.py` | Verify DPDP data_rights router is registered |
| **E** | Both service `main.py` files | Replace CORSMiddleware with env-driven origins |
| **F** | All 3 service `main.py` files | Add Sentry initialization |
| **G** | `backend/auth-service/app/services/auth_service.py` | Remove OTP from log line |
| **H** | `hospyn-v2-web/src/pages/OwnerDashboard.jsx` | Remove mock_token_123 block |

```bash
# Phase 4 — nginx
cp hospyn_phase3_4/nginx.conf nginx.conf
# Then follow the MANUAL STEP comments in the file for TLS certs
```

---

### PHASE 4 — Secrets (all MANUAL)

Run these one-time commands and put the output in GitHub Secrets AND `.env` files:

```bash
# FERNET_KEY
python generate_new_key.py

# AUDIT_HMAC_SECRET
python -c "import secrets; print(secrets.token_hex(32))"

# JWT_SECRET_KEY / JWT_REFRESH_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"

# REDIS_PASSWORD / POSTGRES_PASSWORD
openssl rand -base64 32

# RSA key pair for RS256 JWT
openssl genrsa -out jwt_private.pem 2048
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
# Store jwt_private.pem content as JWT_PRIVATE_KEY_PEM in GitHub Secrets

# GEMINI_API_KEY
# Get from: https://aistudio.google.com  (free tier is enough for pilot)

# SENTRY_DSN
# Create project at: https://sentry.io  (free tier: 5000 errors/month)
```

---

## Manual Steps Summary

| # | Step | Priority | Owner |
|---|------|----------|-------|
| 1 | Set `down_revision` in `phase3_new_tables.py` then run `alembic upgrade head` | CRITICAL | Backend dev |
| 2 | Register `BillingView` route in reception-portal | CRITICAL | Frontend dev |
| 3 | Register `BillingScreen` + `BillingDetailScreen` in patient-app navigator | CRITICAL | React Native dev |
| 4 | Register `DoctorDashboard` in doctor-app routing | CRITICAL | Frontend dev |
| 5 | Apply security_hardening.py sections A–H to each file | CRITICAL | Backend dev |
| 6 | Set all secrets (FERNET_KEY, AUDIT_HMAC_SECRET, etc.) | CRITICAL | DevOps |
| 7 | Get Gemini API key from aistudio.google.com, add to ai-service .env | HIGH | Any |
| 8 | Set up Sentry account, copy DSN to all service .env files | HIGH | DevOps |
| 9 | Uncomment real TLS cert paths in nginx.conf after running certbot | HIGH | DevOps |
| 10 | Set `ALLOWED_ORIGINS` to your production domain list | HIGH | Backend dev |
| 11 | Test complete UPI billing flow end-to-end on staging | HIGH | QA |
| 12 | Doctor reviews and signs off triage thresholds before setting `ENABLE_TRIAGE_ENGINE=true` | HIGH | Medical advisor |
| 13 | Run `git filter-repo` to purge Fernet key from git history | HIGH | DevOps |

---

## After Applying — Test Checklist

```bash
# Backend smoke tests
curl -s http://localhost:8000/health | jq .
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/doctor/stats | jq .
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/patient/vitals | jq .
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/staff/list | jq .
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/owner/dashboard | jq .

# Billing flow test
# 1. Create invoice: POST /api/v1/billing/invoice
# 2. Get UPI URL: GET /api/v1/billing/invoice/{id}/upi-url
# 3. Mark paid: PATCH /api/v1/billing/invoice/{id}/mark-paid
# 4. Download receipt: GET /api/v1/billing/invoice/{id}/receipt

# HR Portal — open http://localhost:3003 (or your hr-portal port)
# Should show: Staff Directory, Shift Roster, Leave Requests in sidebar

# Doctor App — open http://localhost:5174
# Stats cards should show real numbers (not 0 or error)
# Alerts tab should load without 404
# Break button should toggle doctor status
```

---

## What's NOT in This Package (Phase 5+)

These are intentionally deferred:
- Terraform apply (`terraform apply` — MANUAL: requires GCP access)
- PostgreSQL test DB switch in conftest.py (Phase 5.2)
- Integration tests (Phase 5.3)
- WebSocket real-time testing (Phase 6.1)
- Firebase push notifications wiring (Phase 6.2)
- Pharma App and Partner App (Phase 7)

---

*End of Phase 3 & 4 Apply Instructions*
