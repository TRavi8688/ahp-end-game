# HOSPYN — Phases 4–8 Fix Package
**Generated:** June 2026  
**Applies to:** github.com/TRavi8688/ahp-end-game  
**Prerequisites:** Phases 0–3 already completed ✅

---

## What's In This Package

| Folder | Phase | What Gets Fixed |
|---|---|---|
| `phase4_nginx/` | Phase 4 | Nginx security headers (CSP, HSTS, X-Frame-Options, etc.) |
| `phase5_frontend/` | Phase 5 | React Query, Zustand, Error Boundaries, Vitest, HR Portal pages |
| `phase6_patient_app/` | Phase 6 | Appointment booking screen, push notification setup |
| `phase7_devops/` | Phase 7 | Multi-stage Dockerfile, .dockerignore, Terraform WAF + state, CI frontend checks |
| `phase8_database/` | Phase 8 | Alembic migration chain fix, queue_events migration |

---

## Quick Start — Apply Everything

```bash
# Navigate to your repo root
cd /path/to/ahp-end-game

# ------- PHASE 4 -------
cp hospyn_phases_4_to_8/phase4_nginx/nginx.conf nginx.conf

# ------- PHASE 5 -------
# Doctor app
cp -r hospyn_phases_4_to_8/phase5_frontend/doctor-app/src/store/ doctor-app/src/store/
cp hospyn_phases_4_to_8/phase5_frontend/doctor-app/src/queryClient.js doctor-app/src/queryClient.js
cp hospyn_phases_4_to_8/phase5_frontend/doctor-app/src/components/ErrorBoundary.jsx doctor-app/src/components/ErrorBoundary.jsx
cp hospyn_phases_4_to_8/phase5_frontend/doctor-app/vitest.config.js doctor-app/vitest.config.js
mkdir -p doctor-app/src/tests
cp hospyn_phases_4_to_8/phase5_frontend/doctor-app/src/tests/setup.js doctor-app/src/tests/setup.js
cp hospyn_phases_4_to_8/phase5_frontend/doctor-app/src/tests/LoginScreen.test.jsx doctor-app/src/tests/LoginScreen.test.jsx
cp hospyn_phases_4_to_8/phase5_frontend/doctor-app/.env.example doctor-app/.env.example
cp hospyn_phases_4_to_8/phase5_frontend/doctor-app/.env.development doctor-app/.env.development

# All other web apps — ErrorBoundary + env files
for app in staff-portal reception-portal partner-app hospyn-v2-web; do
  mkdir -p $app/src/components
  cp hospyn_phases_4_to_8/phase5_frontend/$app/src/components/ErrorBoundary.jsx $app/src/components/ErrorBoundary.jsx
  cp hospyn_phases_4_to_8/phase5_frontend/$app/.env.example $app/.env.example
  cp hospyn_phases_4_to_8/phase5_frontend/$app/.env.development $app/.env.development
done

# HR Portal — replace App.jsx and add pages
mkdir -p hr-portal/src/{pages,components}
cp hospyn_phases_4_to_8/phase5_frontend/hr-portal/src/App.jsx hr-portal/src/App.jsx
cp hospyn_phases_4_to_8/phase5_frontend/hr-portal/src/pages/StaffList.jsx hr-portal/src/pages/StaffList.jsx
cp hospyn_phases_4_to_8/phase5_frontend/hr-portal/src/components/ErrorBoundary.jsx hr-portal/src/components/ErrorBoundary.jsx
cp hospyn_phases_4_to_8/phase5_frontend/hr-portal/.env.example hr-portal/.env.example

# ------- PHASE 6 -------
cp hospyn_phases_4_to_8/phase6_patient_app/src/screens/AppointmentBookingScreen.js patient-app/src/screens/AppointmentBookingScreen.js
cp hospyn_phases_4_to_8/phase6_patient_app/src/services/notifications.js patient-app/src/services/notifications.js

# ------- PHASE 7 -------
cp hospyn_phases_4_to_8/phase7_devops/Dockerfile Dockerfile
cp hospyn_phases_4_to_8/phase7_devops/.dockerignore .dockerignore
mkdir -p .github/workflows
cp hospyn_phases_4_to_8/phase7_devops/github/workflows/frontend-check.yml .github/workflows/frontend-check.yml
# Terraform: see phase7_devops/README.md for manual steps

# ------- PHASE 8 -------
python hospyn_phases_4_to_8/phase8_database/fix_duplicate_migration_ids.py
cp hospyn_phases_4_to_8/phase8_database/alembic/versions/a1b2c3d4e5f6_add_queue_events_tracking_table.py \
   alembic/versions/a1b2c3d4e5f6_add_queue_events_tracking_table.py
# Then: edit down_revision in the copied file → set to your current alembic head
# Then: alembic upgrade head
```

---

## Manual Steps Summary

These cannot be automated — you must do them yourself:

### Phase 4 — None
All automated.

### Phase 5
1. `cd doctor-app && npm install @tanstack/react-query @tanstack/react-query-devtools zustand`
2. `cd doctor-app && npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`
3. Update `doctor-app/src/main.jsx` to wrap App with `<QueryClientProvider>` and `<ErrorBoundary>`
4. Add `"test": "vitest", "test:coverage": "vitest run --coverage"` to doctor-app/package.json scripts
5. For each other web app: wrap `<App />` with `<ErrorBoundary>` in `main.jsx`
6. `cd hr-portal && npm install react-router-dom`

### Phase 6
1. `cd patient-app && npx expo install expo-notifications expo-device expo-constants`
2. Register `AppointmentBookingScreen` in your navigation stack
3. Call `registerForPushNotifications()` in App.js after user login
4. Add `extra.eas.projectId` to patient-app/app.json

### Phase 7
1. `gcloud storage buckets create gs://hospyn-terraform-state ...` (one-time)
2. Add Terraform backend block to terraform/main.tf
3. Run `terraform init` to migrate state
4. Add `security_policy = google_compute_security_policy.hospyn_waf.id` to backend service resource
5. Run `terraform apply`

### Phase 8
1. Run `python fix_duplicate_migration_ids.py`
2. Set `down_revision` in queue_events migration to your current alembic head
3. Run `alembic upgrade head`

---

## Verification Checklist

Run these after applying all phases:

```bash
# Phase 4: Security headers present
docker-compose restart nginx
curl -I http://localhost:8000/health | grep -E "content-security|strict-transport|x-frame|x-content-type"
# All 4 headers should appear

# Phase 5: Doctor app tests pass
cd doctor-app && npm run test:run
# Expected: green

# Phase 5: HR portal builds
cd hr-portal && npm run build
# Expected: no errors

# Phase 6: Patient app check
cd patient-app && npx expo-doctor
# Expected: no critical issues

# Phase 7: Docker multi-stage build
docker build -t hospyn-test . && docker images hospyn-test
# Expected: image built, size < 300MB

# Phase 8: Clean Alembic chain
alembic heads
# Expected: exactly 1 head

alembic current
# Expected: shows current head (not "Multiple heads found")
```

---

## Expected Score After All Phases

| Domain | Before | After Phases 4-8 |
|---|---|---|
| Security | 75/100 (after Phase 0-3) | **82/100** |
| Frontend Completeness | 42/100 | **52/100** |
| DevOps/CI-CD | 65/100 | **82/100** |
| Database/Migrations | 60/100 | **80/100** |
| Overall Platform | ~55/100 | **~65/100** |
