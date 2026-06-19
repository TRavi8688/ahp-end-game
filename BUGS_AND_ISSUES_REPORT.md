# Bug & Issues Report — June 19, 2026

## Summary
- **Total issues found:** 18
- **Critical:** 5 | **High:** 8 | **Medium:** 3 | **Low:** 2
- **Products/services covered:** 
  - API Gateway (`gateway` / `start_api.py`)
  - Authentication Service (`auth-service`)
  - Healthcare Core Service (`healthcare-core`)
  - AI Service (`ai-service`)
  - Nginx Reverse Proxy (`nginx`)
  - Patient Mobile App (`patient-app`)
  - Doctor Portal Web App (`doctor-app`)
  - HR Portal Web App (`hr-portal`)
  - Web Portals (`staff-portal`, `reception-portal`, `partner-app`, `hospyn-v2-web`)
- **Products/services you could NOT fully check (and why):** None. Every service has been fully audited against the checklist.

---

## CRITICAL Issues

### [ISSUE-001] Authentication Service Router and Health Check Are Completely Unregistered
**Service/Product:** Auth Service
**File:** [backend/auth-service/app/main.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/auth-service/app/main.py)
**Code:**
```python
# Entire file (50 lines) has only CORS configuration and imports:
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

app = FastAPI()

def configure_cors(app: FastAPI) -> None:
    ...
configure_cors(app)
```
**Problem:** The `auth-service` application entrypoint does not import or include the API router (`app.api.router`). It also does not define a `/health` endpoint.
**Impact:** 
1. All authentication endpoints (registration, login, OTP verify, password reset) return `404 Not Found` in production.
2. The Docker container healthcheck (`curl -f http://localhost:8001/health`) and the API Gateway service-ready polling loop fail, causing deployment rollout failures or immediate container restarts.

---

### [ISSUE-002] API Gateway Path Routing Mismatch Prepend Bugs
**Service/Product:** API Gateway
**File:** [start_api.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/start_api.py#L250-L289)
**Code:**
```python
    # Auth routes
    if safe_path.startswith("auth/"):
        url = f"{AUTH_SERVICE_URL}/api/v1/{safe_path}"

    # Patient login shortcut → auth service
    elif safe_path.startswith("patient/login-hospyn"):
        url = f"{AUTH_SERVICE_URL}/api/v1/auth/login"

    # Patient profile setup → healthcare
    elif safe_path.startswith("patient/setup-profile"):
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/patients/"

    # General patient routes
    elif safe_path.startswith("patient/"):
        sub = safe_path.removeprefix("patient/")
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/patients/{sub}"

    # Healthcare core routes
    elif safe_path.startswith(("healthcare/", "doctors/", "hospitals/", "appointments/")):
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/{safe_path}"

    # Explicit fallthrough to healthcare (known catch-all, now intentional)
    else:
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/{safe_path}"
```
**Problem:** The gateway forwards path routes incorrectly to internal microservices:
1. For authentication, the gateway forwards `/auth/login` to `AUTH_SERVICE_URL/api/v1/auth/login`. However, `auth-service` registers its router at `/api/v1/login` directly (no `/auth/` segment).
2. For all healthcare core routes, the gateway prepends `/healthcare/` (e.g. `HEALTHCARE_SERVICE_URL/api/v1/healthcare/patients/`), but `healthcare-core` is mounted at `prefix="/api/v1"` directly (e.g. `/api/v1/patients/`, no `/healthcare/` segment).
**Impact:** Every single client request routed through the API Gateway (authentication, profile creation, booking appointments, listing doctors) will return `404 Not Found` from the target service due to these path mismatches.

---

### [ISSUE-003] AI Service Missing Core Dependencies
**Service/Product:** AI Service
**File:** [backend/ai-service/requirements.txt](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/ai-service/requirements.txt)
**Code:**
```
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
pydantic>=2.6.0
httpx>=0.26.0
google-generativeai>=0.4.0
structlog>=24.1.0
sentry-sdk[fastapi]>=1.40.0
```
**Problem:** The AI service uses `sqlalchemy` in [backend/ai-service/app/main.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/ai-service/app/main.py#L12) and database driver `asyncpg` to verify patient consent before invoking AI operations, but neither library is declared in its `requirements.txt`.
**Impact:** During build and container startup, the service will crash immediately with `ModuleNotFoundError: No module named 'sqlalchemy'`, resulting in total service failure.

---

### [ISSUE-004] AI Service Missing DB module and Session Helper
**Service/Product:** AI Service
**File:** [backend/ai-service/app/models/consent.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/ai-service/app/models/consent.py#L13)
**Code:**
```python
from app.db.base_class import Base  # adjust path as needed
```
**Problem:** The AI service model `consent.py` tries to import `Base` from `app.db.base_class`. However, the `app/db` directory and `base_class.py` do not exist within `ai-service`. Furthermore, the `get_db` session helper fallback in `main.py` is hardcoded to raise a 503 error.
**Impact:** Invoking any AI route triggers an import of `ConsentRecord`, causing the application to crash with `ModuleNotFoundError: No module named 'app.db'`. Even if bypassed, the fallback `get_db` denies database sessions entirely.

---

### [ISSUE-005] Non-Existent `consent_records` Database Table
**Service/Product:** AI Service
**File:** [backend/ai-service/app/main.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/ai-service/app/main.py#L101-L112)
**Code:**
```python
    record = (
        db.query(ConsentRecord)
        .filter(
            ConsentRecord.patient_id == patient_id,
            ConsentRecord.consent_type == ConsentType.AI_PROCESSING,
            ConsentRecord.revoked_at.is_(None),
        )
        .first()
    )
```
**Problem:** The AI Service queries the `consent_records` SQL table to verify DPDP consent. However, no database migrations or schemas exist in `healthcare-core` or `ai-service` to create a `consent_records` table in the PostgreSQL database.
**Impact:** Any attempt to request AI clinical summarization or triage will trigger an active SQLAlchemy execution crash: `relation "consent_records" does not exist`.

---

## HIGH Severity Issues

### [ISSUE-006] Redis Client is Never Initialized at Startup
**Service/Product:** Auth Service / Healthcare Core
**File:** [backend/auth-service/app/main.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/auth-service/app/main.py) & [backend/healthcare-core/app/main.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/main.py)
**Code:** No calls to `init_redis` exist in either file.
**Problem:** The services import methods from `shared.redis_client` but never invoke `init_redis(redis_url)` inside their lifespan context or startup hooks.
**Impact:** The global `_redis_pool` remains `None`. Because the Redis checks fail-open to prevent complete downtime:
1. Token blacklisting upon logout or password change fails silently.
2. Blacklist validation always allows revoked tokens through.
3. User status checks (suspension / password changes) always cache-miss and fail-open.
4. Brute-force rate limits and OTP lockout protection are bypassed.

---

### [ISSUE-007] Hardcoded Unsafe `JWT_SECRET_KEY` Falls Back to Default in Production
**Service/Product:** Auth Service / Healthcare Core
**File:** [backend/auth-service/app/config/settings.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/auth-service/app/config/settings.py#L20-L22) & [backend/healthcare-core/app/config/settings.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/config/settings.py#L19-L21)
**Code:**
```python
    JWT_SECRET_KEY: str = (
        "local_dev_secret_key_must_be_at_least_32_characters_long_for_security"
    )
```
**Problem:** `JWT_SECRET_KEY` is not mapped in `docker-compose.yml` under `environment:` properties (only `SECRET_KEY` is). Because `run_startup_checks()` is not wired in either service's entrypoint, the services start in production using this fallback value. Additionally, this key is not blocked by `FORBIDDEN_VALUES` in `startup_check.py`.
**Impact:** Active microservices will sign and validate JWT tokens using this publicly visible default key in production, enabling attackers to forge administrative auth tokens.

---

### [ISSUE-008] Sensitive Data Decrypted/Encrypted with Known Deterministic Seed Key in Production
**Service/Product:** Shared Codebase
**File:** [backend/shared/encryption.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/shared/encryption.py#L45-L59)
**Code:**
```python
    environment = os.environ.get("ENVIRONMENT", "development").lower()
    if environment == "production":
        raise ValueError("ENCRYPTION_KEY environment variable is REQUIRED in production.")
    
    dev_seed = b"hospyn-dev-only-encryption-seed-do-not-use-in-prod"
    dev_key = base64.urlsafe_b64encode(hashlib.sha256(dev_seed).digest())
    return [Fernet(dev_key)]
```
**Problem:** The key loader searches for `os.environ.get("ENVIRONMENT")` to block startup if `ENCRYPTION_KEY` is missing in production. However, `docker-compose.yml` sets `ENV=production`, leaving `ENVIRONMENT` completely unset.
**Impact:** The service silently falls back to the deterministic development key seed in production, encrypting all sensitive patient PHI (chronic conditions, allergies, emergency contact info) using a compromised hardcoded key.

---

### [ISSUE-009] AI Service Lacks Token Verification (Unauthenticated Access)
**Service/Product:** AI Service
**File:** [backend/ai-service/app/main.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/ai-service/app/main.py#L159-L164)
**Code:**
```python
@app.post("/api/v1/ai/summarize", response_model=ClinicalSummaryResponse)
async def summarize_clinical_note(
    request: ClinicalSummaryRequest,
    db: Session = Depends(get_db),
    authorization: str = Header(...),
):
```
**Problem:** The AI endpoints accept `authorization: str = Header(...)` but contain no logic to decode, verify, or validate the signature/payload of the JWT token.
**Impact:** Anyone can pass an arbitrary, dummy string as the authorization header to call clinical note summarization and triage logic, leading to complete authorization bypass.

---

### [ISSUE-010] Disconnected / Broken Alembic Migration History
**Service/Product:** Healthcare Core
**File:** [backend/healthcare-core/alembic/versions/003_billing.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/alembic/versions/003_billing.py#L12)
**Code:**
```python
down_revision = "002_previous_head"   # UPDATE THIS
```
**Problem:** The `003_billing.py` migration points to a down-revision of `"002_previous_head"`, which does not exist in the migration tree. Furthermore, a second independent chain starts directly from `001_initial` (`6df9cf33819a` -> `a5f82bb547d2`).
**Impact:** Attempting to run `alembic upgrade head` in production crashes immediately due to disconnected tree resolution, blocking database initialization.

---

### [ISSUE-011] Missing Twilio Library Dependency in Auth Service
**Service/Product:** Auth Service
**File:** [backend/auth-service/requirements.txt](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/auth-service/requirements.txt)
**Code:** Missing `twilio` dependency.
**Problem:** `twilio` is imported in `auth_service.py` (line 145) to send OTP codes, but is not declared in the service's `requirements.txt`.
**Impact:** If SMS OTP delivery is triggered (configured as primary delivery in settings), the auth container will throw a `ModuleNotFoundError: No module named 'twilio'` and crash mid-request.

---

### [ISSUE-012] Patient App Client Lacks Push Notification Wiring
**Service/Product:** Patient Mobile App
**File:** [patient-app/App.js](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/patient-app/App.js) & [patient-app/package.json](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/patient-app/package.json)
**Code:** Missing `expo-notifications`, `expo-device`, and `expo-constants` dependencies, and lacking code for token registration or deep link handlers.
**Problem:** The mobile client-side push notification registration, permission checks, and tap routing have not been copied or wired into the active codebase.
**Impact:** The application cannot request push token permissions or communicate push tokens to the backend.

---

### [ISSUE-013] Missing Patient Push Token Backend Endpoint and Schema Fields
**Service/Product:** Healthcare Core
**File:** [backend/healthcare-core/app/models/patient.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/models/patient.py) & [backend/healthcare-core/app/api/v1/patients.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/api/v1/patients.py)
**Code:** No `push_token` fields or registration endpoint defined.
**Problem:** The database migrations, model properties (`push_token`, `push_token_platform`), and the API endpoint `/patients/push-token` are entirely missing.
**Impact:** Client requests trying to upload registration tokens fail with `404 Not Found`.

---

## MEDIUM Severity Issues

### [ISSUE-014] JWT Token Mismatches: HS256 vs Asymmetric RS256
**Service/Product:** Auth Service
**File:** [backend/auth-service/app/services/auth_service.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/auth-service/app/services/auth_service.py#L65-L86) vs [backend/auth-service/app/core/security.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/auth-service/app/core/security.py#L65-L86)
**Problem:** `auth_service.py` signs tokens using symmetric HS256 via `JWT_SECRET_KEY`. However, `security.py` generates tokens using RS256 with key PEMs. The active `router.py` imports token creation functions from `auth_service.py` (HS256).
**Impact:** The security model reverts to symmetric HS256 instead of RS256. If a service attempts to validate using RS256, it will fail. Furthermore, the development fallback in `security.py` generates ephemeral RSA keys, meaning a server reboot would instantly invalidate all issued tokens.

---

### [ISSUE-015] Conflict in Redis Database Index Settings
**Service/Product:** Auth Service / Healthcare Core
**File:** [backend/auth-service/app/config/settings.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/auth-service/app/config/settings.py#L14) & [backend/healthcare-core/app/config/settings.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/config/settings.py#L13)
**Code:**
- `auth-service`: `REDIS_URL = "redis://localhost:6379/0"` (Index 0)
- `healthcare-core`: `REDIS_URL = "redis://localhost:6379/1"` (Index 1)
**Problem:** The default database indices for the two services differ. 
**Impact:** Outside the Docker environment (which overrides this by using the same default index `0`), the services write and read blacklists/user statuses from different Redis databases. Consequently, `healthcare-core` will never see token blacklists or user updates published by `auth-service`.

---

### [ISSUE-016] AI Service is Completely Unreachable in the API Gateway
**Service/Product:** API Gateway
**File:** [start_api.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/start_api.py)
**Code:** The variable `AI_SERVICE_URL` is defined but never referenced or integrated into `route_all`.
**Problem:** The gateway does not proxy paths starting with `ai/` to the AI microservice.
**Impact:** Requests targeting the AI service (e.g. `/api/v1/ai/summarize`) fall through to the catch-all router, forwarding them to `healthcare-core`, which returns `404 Not Found`.

---

## LOW Severity Issues

### [ISSUE-017] Observability Integrations Are Not Wired in healthcare-core
**Service/Product:** Healthcare Core
**File:** [backend/healthcare-core/app/main.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/main.py)
**Code:** No imports or calls to `setup_sentry(settings)` or `setup_prometheus(app)`.
**Problem:** The observability code is defined in [observability.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/core/observability.py) but is never imported or called in the main application module.
**Impact:** Sentry error reporting, request count tracking, and the `/metrics` endpoint are disabled in production.

---

### [ISSUE-018] HR Portal App Missing UI Pages and Components
**Service/Product:** HR Portal Web App
**File:** [hr-portal/src/App.jsx](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/hr-portal/src/App.jsx)
**Code:** App lacks imports for routing or external pages.
**Problem:** The UI components and pages (such as `StaffList.jsx` and `ErrorBoundary.jsx`) mentioned in the deployment guides are completely missing from the directory structure.
**Impact:** The portal renders a static mock layout rather than the dynamic connected views.

---

## Cross-Service Contract Mismatches

1. **Gateway -> Auth Service Path Mismatch:**
   - **Gateway expectation:** `url = f"{AUTH_SERVICE_URL}/api/v1/auth/login"`
   - **Auth Service actual:** `prefix="/api/v1"`, route `"/login"` -> `/api/v1/login`.
   - **Result:** `404 Not Found` for all auth routes.

2. **Gateway -> Healthcare Core Path Mismatch:**
   - **Gateway expectation:** `url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/patients/"`
   - **Healthcare Core actual:** `prefix="/api/v1"`, route `"/patients"` -> `/api/v1/patients/`.
   - **Result:** `404 Not Found` for all healthcare routes.

3. **Consent Records (AI Service -> Healthcare Core):**
   - **AI Service expectation:** A database table named `consent_records` exists in the shared database.
   - **Healthcare Core actual:** No models, schemas, or migrations exist for the `consent_records` table.
   - **Result:** AI operations fail with `relation "consent_records" does not exist`.

---

## Missing/Unregistered Routes

- **Auth Service Router (Unregistered):** [backend/auth-service/app/api/router.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/auth-service/app/api/router.py) is never imported or mounted inside `auth-service`'s `main.py`.
- **JWKS Endpoint (Unregistered):** [backend/auth-service/app/api/jwks.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/auth-service/app/api/jwks.py) is never mounted, making asymmetric public key retrieval impossible.
- **AI Service Gateway Route (Unregistered):** There is no forwarding rule for `/api/v1/ai/` inside `start_api.py` to route to `AI_SERVICE_URL`.

---

## Dead Code / Orphaned Modules

- **Unused Doctor Extensions:** [backend/healthcare-core/app/api/v1/doctor_extensions.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/api/v1/doctor_extensions.py) is an orphaned duplicate of `doctor_stats_alerts.py`.
- **Unused Patient Extensions:** [backend/healthcare-core/app/api/v1/patient_extensions.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/api/v1/patient_extensions.py) is an orphaned duplicate of `patient_vitals_notifications.py`.
- **Unused Security Hardening Snippets:** [backend/healthcare-core/app/api/v1/security_hardening.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/healthcare-core/app/api/v1/security_hardening.py) is a snippet/template file that is never imported.
- **Unused Startup Secrets Validation:** `validate_production_secrets` inside [backend/shared/startup_checks.py](file:///c:/Users/DELL/OneDrive/Desktop/ahp-end-game-complete/backend/shared/startup_checks.py) is never called.
- **Legacy App Stub:** The root `/app` directory contains legacy stubs (`app/core/config.py`, `app/core/startup_check.py`, and `app/services/audit_service.py`) that are completely ignored by the build processes in favor of `backend/`.
