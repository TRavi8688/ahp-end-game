# Hospyn — Phase 07–10 Permanent Fixes
## Applied to: TRavi8688/ahp-end-game

---

## PHASE 07 — Docker & DevOps (Score was: 40/100 → Target: 85/100)

### Files in `/phase07-docker-devops/`

| File | What was fixed |
|---|---|
| `Dockerfile` | **CRITICAL**: Replaced `COPY . .` with selective explicit COPY of `app/`, `alembic/`, `alembic.ini` only. Added `HEALTHCHECK`. Installed `curl` for health probe. Non-root user was already present — kept. |
| `Dockerfile.gateway` | **CRITICAL**: Added non-root user (`gateway`) — was running as root. Added `HEALTHCHECK`. Only copies `start_api.py`, not the full repo. |
| `docker-compose.yml` | **CRITICAL**: SQLite replaced with PostgreSQL. Redis password required (no longer unauthenticated). Redis port `6379` no longer exposed externally. Postgres port not exposed. `healthcheck` added to postgres so services wait with `condition: service_healthy`. All secrets from `.env`. |
| `dockerignore` | **Rename to `.dockerignore`**: Comprehensive exclusion of `enc.key`, `.env*`, `scratch.py`, `archive/`, `backups/`, all frontend apps, Firebase, Terraform — clean minimal image. |
| `entrypoint.sh` | **HIGH**: Added PostgreSQL readiness wait loop before uvicorn starts. Added startup secret validation (refuses to start if SECRET_KEY is empty or default). |
| `env.example` | **Rename to `.env.example`**: Documents all required env vars — PostgreSQL, Redis password, CORS origins, SECRET_KEY generation command. |

### How to apply Phase 07:
```bash
# In your repo root:
cp phase07-docker-devops/Dockerfile ./Dockerfile
cp phase07-docker-devops/Dockerfile.gateway ./Dockerfile.gateway
cp phase07-docker-devops/docker-compose.yml ./docker-compose.yml
cp phase07-docker-devops/dockerignore ./.dockerignore
cp phase07-docker-devops/entrypoint.sh ./entrypoint.sh
cp phase07-docker-devops/env.example ./.env.example
chmod +x ./entrypoint.sh

# Then create .env from example and fill in all values:
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, REDIS_PASSWORD, SECRET_KEY

# Test:
docker-compose up -d
docker-compose ps   # all containers should show "healthy"
```

---

## PHASE 08 — Infrastructure (Score was: 15/100 → Target: 70/100)

### Files in `/phase08-infrastructure/`

| File | What was fixed |
|---|---|
| `github/workflows/ci-cd.yml` | **CRITICAL**: First CI/CD pipeline. Runs bandit SAST, safety CVE scan, pytest with PostgreSQL service on every PR. Blocks merge on test failure. Deploys to Cloud Run on merge to main. Runs DB migrations before new container takes traffic. |
| `backup.sh` | **CRITICAL**: Backups now uploaded to GCS after compression. Upload is verified (size check). `alert_failure` function sends Slack notification on failure. Local cleanup retained. `set -euo pipefail` ensures any error exits. |
| `terraform/main.tf` | **CRITICAL**: Deployable GCP infrastructure. Cloud Run, Cloud SQL PostgreSQL 15 with HA failover, Memorystore Redis with auth, GCS backup bucket with 90-day retention, Secret Manager for all credentials, VPC with private networking. |

### How to apply Phase 08:
```bash
# CI/CD — copy to .github/workflows/ (create directory if needed):
mkdir -p .github/workflows
cp phase08-infrastructure/github/workflows/ci-cd.yml .github/workflows/ci-cd.yml

# Add these secrets to your GitHub repo Settings → Secrets:
#   GCP_PROJECT_ID, GCP_SA_KEY

# Backup script:
cp phase08-infrastructure/backup.sh ./backup.sh
chmod +x ./backup.sh

# Set up as cron (run daily at 2 AM):
# 0 2 * * * /path/to/backup.sh >> /var/log/hospyn-backup.log 2>&1

# Terraform:
cp -r phase08-infrastructure/terraform/* ./terraform/
cd terraform
terraform init
terraform plan -var="project_id=YOUR_GCP_PROJECT" -var="postgres_password=STRONG_PASSWORD"
terraform apply
```

---

## PHASE 09 — Frontend (Score was: 45/100 → Target: 72/100)

### Files in `/phase09-frontend/`

| File | What was fixed |
|---|---|
| `package.json` (root) | Turborepo monorepo setup — manages all 8 frontend apps + shared packages with unified build/test/lint commands. |
| `packages/ui/package.json` | `@hospyn/ui` shared component library definition. |
| `packages/ui/tsconfig.json` | Strict TypeScript config — `strict: true`, `noImplicitAny`, `noUnusedLocals`. |
| `packages/ui/src/index.ts` | Library exports — Button, StatusBadge, PatientCard, QueueToken, etc. |
| `packages/ui/src/components/Button.tsx` | Production-quality TypeScript React component with variants, sizes, loading state, accessibility. |
| `packages/ui/src/components/StatusBadge.tsx` | Unified status display — replaces 8 different per-app status systems. |

### How to apply Phase 09:
```bash
# Install Turborepo:
npm install -g turbo

# Copy shared package to your repo:
mkdir -p packages/ui
cp -r phase09-frontend/packages/ui/* ./packages/ui/
cp phase09-frontend/package.json ./package.json  # WARNING: merge with existing if present

# Install:
npm install

# In each frontend app, add to package.json dependencies:
#   "@hospyn/ui": "*"

# Build shared lib:
turbo build --filter=@hospyn/ui

# TypeScript migration: rename .js files to .ts/.tsx incrementally
# Start with new files — never touch working .js files until you have tests
```

---

## PHASE 10 — AI Architecture (Score was: 30/100 → Target: 65/100)

### Files in `/phase10-ai/`

| File | What was fixed |
|---|---|
| `ai-service/app/main.py` | **CRITICAL**: AI Service microservice (was completely missing). PHI scrubbing applied BEFORE any LLM call. Patient consent verified (DPDP) before processing. Triage thresholds clearly marked as NOT clinically validated. Audit logging on every AI call. |
| `ai-service/Dockerfile` | Container for the AI service with non-root user and HEALTHCHECK. |
| `ai-service/requirements.txt` | AI service dependencies. |

### Critical notes for Phase 10:
1. **DO NOT call the `/summarize` endpoint until `consent_records` table is implemented** (Phase 13).
2. **DO NOT use triage thresholds in production** until reviewed by licensed medical professionals.
3. **Add ai-service to docker-compose.yml**:
   ```yaml
   ai-service:
     build:
       context: ./backend/ai-service
       dockerfile: Dockerfile
     environment:
       - GEMINI_API_KEY=${GEMINI_API_KEY}
       - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
     ports:
       - "8003:8003"
   ```
4. **Add routing in gateway** (`start_api.py`): proxy `/api/v1/ai/*` to `http://ai-service:8003`.

---

## Summary of remaining critical issues NOT in this zip:

These require separate work and are NOT in Phase 07–10 scope:

- `enc.key` rotation — **DO THIS FIRST** before any other fix. Use `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Purge old key from git history with BFG Repo Cleaner.
- `create_admin.py` — delete from repository.
- `start_api.py` CORS wildcard default — change `allow_origins=["*"]` to `allow_origins=ALLOWED_ORIGINS` from env.
- DPDP consent_records table — required before AI service can process PHI.
- Test suite — 0% coverage is unacceptable for clinical software.
- "PRODUCTION READY" claim in Blueprint Part 5 — remove immediately.

---

*Generated: June 2026 | Hospyn Phase 07–10 Permanent Fixes*
