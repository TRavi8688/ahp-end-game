# Hospyn 2.0 System Hardening & Expansion Roadmap

## Phase 1: Security & Architecture Hardening (CRITICAL)
- `[ ]` 1. Extract SPA & Configure Vercel Routing
  - `[ ]` Create `doctor-app/vercel.json`
  - `[ ]` Create `patient-app/vercel.json`
- `[ ]` 2. Multi-Service Infrastructure Setup
  - `[ ]` Create `railway.toml` for dedicated Worker/API scaling
  - `[ ]` Delete old `railway.json`
  - `[ ]` Optimize `Dockerfile` (multi-stage, non-root)
- `[ ]` 3. API Security & Routing Cleanup
  - `[ ]` Remove SPA static serving (`app/main.py`)
  - `[x]` Fix Admin Invite protection (`app/api/admin.py`)
  - `[ ]` Fix `trusted_hosts=["*"]` wildcard vulnerability
  - `[ ]` Secure `/health` endpoint to prevent info leakage
- `[ ]` 4. Authentication Hardening
  - `[ ]` Remove `_otp_memory_store` RAM vulnerability
  - `[ ]` Mandate Redis usage for OTPs
- `[ ]` 5. Database Integrity
  - `[ ]` Convert string models to PostgreSQL ENUMs
  - `[ ]` Convert JSON columns to JSONB

## Phase 2: Future Expansions (Strategic)
- `[ ]` 6. Pharmacy & Lab Ecosystem
  - `[ ]` Implement `PharmacyOrder` and `LabRequest` models
  - `[ ]` Integrate AI-Prescription OCR pipeline
  - `[ ]` Build Staff Portal dashboards for Pharm/Lab
- `[ ]` 7. Partner Mobile App
  - `[ ]` Configure Expo EAS build pipeline
  - `[ ]` Implement QR-based Patient Rounds
- `[ ]` 8. Global Governance
  - `[ ]` Finalize Super Admin multi-tenant dashboard
  - `[ ]` Add real-time performance monitoring (Sentry/Posthog)
