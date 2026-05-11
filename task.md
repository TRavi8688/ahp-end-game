# Hospyn 2.0: Master Production Roadmap

## PHASE 1: Security & Decoupling (CRITICAL)
- `[ ]` **Task 1: SPA Extraction**
  - `[ ]` Create `vercel.json` for `doctor-app` and `patient-app`
  - `[ ]` Remove `StaticFiles` and catch-all routes from `app/main.py`
- `[ ]` **Task 2: Network Lockdown**
  - `[ ]` Replace `trusted_hosts=["*"]` with explicit environment config
  - `[ ]` Secure `/health` and `/readyz` endpoints
- `[ ]` **Task 3: Auth Hardening**
  - `[ ]` Migrate OTP/Session store to Redis
  - `[x]` Secure Hospital Invite endpoints (`app/api/admin.py`)
- `[ ]` **Task 4: DB Schema Hardening**
  - `[ ]` Convert critical fields to PostgreSQL ENUMs and JSONB

## PHASE 2: Functional Expansion (Pharmacy & Lab)
- `[ ]` **Task 5: Hub Implementation**
  - `[ ]` Deploy `PharmacyOrder` and `LabRequest` models
  - `[ ]` Integrate AI-Prescription OCR pipeline
- `[ ]` **Task 6: Staff Portals**
  - `[ ]` Build specialized dashboards for Pharmacy/Lab technicians

## PHASE 3: Scaling & Real-time
- `[ ]` **Task 7: Multi-Service Infrastructure**
  - `[ ]` Configure `railway.toml` for independent API/Worker scaling
  - `[ ]` Optimize Dockerfile for production layers
- `[ ]` **Task 8: Observability**
  - `[ ]` Integrate Sentry and PostHog for production monitoring

## PHASE 4: App Store Readiness
- `[ ]` **Task 9: Mobile Deployment**
  - `[ ]` Configure Expo EAS build pipeline for Android/iOS
  - `[ ]` Final App Store submission for Patient and Partner apps

## PHASE 5: Go-Live & Operations
- `[ ]` **Task 10: Institutional Onboarding**
  - `[ ]` Finalize Super Admin dashboard for tenant management
  - `[ ]` Onboard first 10 pilot hospitals
