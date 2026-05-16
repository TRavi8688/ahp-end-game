# 🛡️ Hospyn 2.0: Ultimate Production & Hardening Roadmap

This roadmap is the definitive guide to transforming Hospyn from a development project into a **High-Level Clinical Platform**. It addresses critical security flaws, stabilizes the Play Store app, and builds the next-gen ERP modules.

---

## 🔴 Phase 0: The "Great Security Purge" (Immediate)
*Target: Remove all vulnerabilities and stop the leakage of secrets.*

1.  **Git Forensic Cleaning**: 
    -   Use `git-filter-repo` or BFG Repo-Cleaner to permanently scrub `.env`, `private_key.pem`, and `enc.key` from the entire Git history.
    -   **Why**: Deleting the file isn't enough; hackers look at past commits.
2.  **Key Rotation**:
    -   Generate a **NEW** RSA 2048-bit key pair for JWT.
    -   Generate a **NEW** 32-byte AES-256 key for database encryption.
    -   Generate a **NEW** production database password (min 32 chars).
3.  **Secret Sovereignty**:
    -   Move all secrets from `.env` files into **GCP Secret Manager** or **Railway Variables**.
    -   Implement a `config.py` that loads secrets dynamically from the environment, never from a file.

---

## 🟠 Phase 1: Production Infrastructure Lockdown
*Target: Ensure the backend is stable, fast, and invisible to attackers.*

1.  **Environment Gating**:
    -   Force `DEBUG=False` in production.
    -   Disable `/docs` and `/redoc` in production to prevent API mapping by external actors.
2.  **CORS & Networking**:
    -   Lock down `ALLOWED_ORIGINS` to only your production domains (`app.mulajna.com`, etc.).
    -   Implement **HTTPS-Only Enforcement** middleware to kill all insecure traffic.
3.  **Worker Durability**:
    -   Deploy a dedicated `ahp-worker` service in GCP/Railway.
    -   Setup **Dead Letter Queues (DLQ)** so if an AI summary fails, it doesn't vanish—it retries.

---

## 🟡 Phase 2: Mobile Production Bridge (Play Store Support)
*Target: Support the live Play Store app and ensure zero-downtime updates.*

1.  **API Versioning**:
    -   Ensure the backend supports `/v1/` prefix to avoid breaking the Play Store app when we add new ERP features.
2.  **EAS Updates (OTA)**:
    -   Configure **Expo Application Services (EAS)**. This allows us to push UI fixes to the Play Store app in 30 seconds without a resubmission.
3.  **Sentry Observability**:
    -   Deploy Sentry across the Mobile App and the Backend.
    -   Set up alerts for **401 Unauthorized** errors (token issues) and **500 Internal Server** errors.

---

## 🟢 Phase 3: Clinical Hardening & Compliance
*Target: Make the platform legally and medically sound.*

1.  **Immutable Audit Logs**:
    -   Enable the `ClinicalEvent` stream for every record view, edit, and AI interaction.
    -   Implement **SHA-256 integrity hashing** for every medical record to prove they haven't been tampered with.
2.  **Doctor "Verify & Sign"**:
    -   Build the UI component in the Doctor Portal that allows a doctor to "Sign-Off" on an AI-extracted summary, converting it from "Informational" to "Clinical Fact."

---

## 🚀 Phase 4: High-Level Platform Expansion (ERP)
*Target: Implementing the "Real Hospital Flow" (Billing, OT, Wards).*

1.  **Vertical Slice: Financial Core**:
    -   Implement the Billing engine. Every lab order in the Play Store app must trigger a billable event in the ERP.
2.  **Vertical Slice: Surgical Workflow**:
    -   Implement OT Scheduling and Pre-Op checklists.
3.  **Vertical Slice: Ward Operations**:
    -   Implement Bed management and Nurse Station dashboards.

---

## 📊 Technical Action Checklist

- [ ] **Step 1**: Run `openssl` to generate new keys.
- [ ] **Step 2**: Update `app/core/config.py` to handle production env vars.
- [ ] **Step 3**: Configure `railway.toml` or `app.yaml` for multi-service deployment (API + Worker).
- [ ] **Step 4**: Initialize Sentry in `main.py`.
- [ ] **Step 5**: Run `alembic upgrade head` on the production database.

---

## 📞 Critical Success Factor
**Zero-Regression Policy**: We will not deploy any backend change that breaks the current Play Store app's login or record upload flow. Every release will be tested against the live mobile build.

> [!TIP]
> This plan transforms Hospyn from a "App" into an "Infrastructure." It ensures that even if you have 10,000 patients tomorrow, the system stays up and the data stays safe.
