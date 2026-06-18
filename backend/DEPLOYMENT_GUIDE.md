# Hospyn Backend — Fix Deployment Guide
## How to apply every fix file in the correct order

---

### Step 0 — Security: rotate compromised secrets first

Before pushing any code, rotate these:

```bash
# 1. Generate new RS256 keypair
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem
export JWT_PRIVATE_KEY_PEM=$(base64 -w0 private_key.pem)
export JWT_PUBLIC_KEY_PEM=$(base64 -w0 public_key.pem)

# 2. Generate new INTERNAL_SERVICE_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# 3. Generate new FERNET_KEY for PHI encryption
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# 4. Generate new PARTNER_JWT_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# 5. Add auth-service/.env to .gitignore NOW
echo "auth-service/.env" >> .gitignore
echo "healthcare-core/.env" >> .gitignore
echo "*.env" >> .gitignore
git rm --cached auth-service/.env 2>/dev/null || true
git rm --cached healthcare-core/.env 2>/dev/null || true
```

---

### Step 1 — Apply shared library fixes

```bash
# Fixes BUG-2, BUG-5, BUG-6 (missing functions), BUG-7 (in-memory circuit breaker),
#       BUG-12 (missing init_redis), SEC-1 (weak internal secret), SEC-3 (startup checks)

cp fixes/shared/redis_client.py         backend/shared/redis_client.py
cp fixes/shared/utils/circuit_breaker.py backend/shared/utils/circuit_breaker.py
cp fixes/shared/utils/event_bus.py      backend/shared/utils/event_bus.py
cp fixes/shared/utils/service_auth.py   backend/shared/utils/service_auth.py
cp fixes/shared/startup_checks.py       backend/shared/startup_checks.py
cp fixes/shared/alerting.py             backend/shared/alerting.py
```

---

### Step 2 — Apply auth-service fixes

```bash
# Fixes BUG-9 (RS256 standardization), BUG-10 (missing twilio),
#       BUG-12 (missing lifespan/init_redis), QUAL-2 (missing router)

cp fixes/auth-service/app/main.py           backend/auth-service/app/main.py
cp fixes/auth-service/app/core/security.py  backend/auth-service/app/core/security.py
cp fixes/auth-service/requirements.txt      backend/auth-service/requirements.txt
```

---

### Step 3 — Apply healthcare-core fixes

```bash
# Fixes BUG-3, BUG-4 (wrong import paths), BUG-8 (double-prefix routes),
#       BUG-11 (missing python-jose), BUG-12 (missing lifespan),
#       ARCH-1 (all core routes unreachable), QUAL-1 (jose import crash),
#       PERF-1 (pool too small)

cp fixes/healthcare-core/app/main.py               backend/healthcare-core/app/main.py
cp fixes/healthcare-core/app/api/router.py          backend/healthcare-core/app/api/router.py
cp fixes/healthcare-core/app/api/internal.py        backend/healthcare-core/app/api/internal.py
cp fixes/healthcare-core/app/middleware/rbac.py     backend/healthcare-core/app/middleware/rbac.py
cp fixes/healthcare-core/app/config/settings.py     backend/healthcare-core/app/config/settings.py
cp fixes/healthcare-core/app/core/database.py       backend/healthcare-core/app/core/database.py
cp fixes/healthcare-core/requirements.txt           backend/healthcare-core/requirements.txt

# Apply the one-line import fix in doctor_extensions.py
# (sed replaces only the broken import line, leaves all business logic intact)
sed -i 's/from backend.shared.utils.event_bus import EventBus/from shared.utils.event_bus import EventBus/' \
    backend/healthcare-core/app/api/v1/doctor_extensions.py
```

---

### Step 4 — Apply infra and nginx fixes

```bash
# Fixes BUG-1 (nginx pointing to non-existent gateway),
#       ARCH-2 (notification-service missing from compose),
#       ARCH-5 (WebSocket routing broken),
#       PERF-3 (nginx worker_connections too low),
#       PERF-4 (rate limit zone tuning)

cp fixes/nginx/nginx.conf              backend/nginx/nginx.conf
cp fixes/infra/docker-compose.yml      backend/infra/docker-compose.yml
cp fixes/infra/docker-compose.dev.yml  backend/infra/docker-compose.dev.yml
```

---

### Step 5 — Apply ai-service fixes

```bash
# Fixes BUG-13 (duplicate google-generativeai, missing sqlalchemy/asyncpg)

cp fixes/ai-service/requirements.txt   backend/ai-service/requirements.txt
```

---

### Step 6 — Add notification DB to init-db.sql

Add this block to `backend/infra/init-db.sql`:

```sql
-- Notification service database and scoped user
CREATE DATABASE hospyn_notifications;
CREATE USER notification_user WITH ENCRYPTED PASSWORD '${NOTIFICATION_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE hospyn_notifications TO notification_user;
ALTER DATABASE hospyn_notifications OWNER TO notification_user;
```

---

### Step 7 — Set all required environment variables

Create `backend/infra/.env.production` (never commit this file):

```bash
# Database
DB_ADMIN_PASSWORD=<rotate-this>
AUTH_DB_PASSWORD=<rotate-this>
HEALTHCARE_DB_PASSWORD=<rotate-this>
AI_DB_PASSWORD=<rotate-this>
NOTIFICATION_DB_PASSWORD=<rotate-this>

# Redis
REDIS_PASSWORD=<rotate-this>

# JWT RS256 Keys (from Step 0)
JWT_PRIVATE_KEY_PEM=<base64-encoded-pem>
JWT_PUBLIC_KEY_PEM=<base64-encoded-pem>

# Internal service auth
INTERNAL_SERVICE_SECRET=<64-char-random-from-step-0>

# PHI encryption
FERNET_KEY=<from-step-0>

# Partner JWT
PARTNER_JWT_SECRET=<48-char-random-from-step-0>

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_FROM_NUMBER=+91xxxxxxxxxx

# GCP
GCP_STORAGE_BUCKET=hospyn-medical-records

# Observability
SENTRY_DSN=https://xxx@oxx.ingest.sentry.io/xxx

# CORS
ALLOWED_ORIGINS=https://hospyn.com,https://www.hospyn.com

# App
ENVIRONMENT=production
```

---

### Step 8 — Run migrations for notification service

```bash
# notification-service needs its own DB schema
cd backend/notification-service
alembic upgrade head
```

---

### Step 9 — Build and test locally

```bash
cd backend/infra
docker compose -f docker-compose.dev.yml up --build

# Smoke tests
curl http://localhost:8000/health                      # nginx
curl http://localhost:8000/health/auth                 # auth-service
curl http://localhost:8000/health/healthcare            # healthcare-core
curl http://localhost:8000/health/ai                   # ai-service
curl http://localhost:8000/health/notifications        # notification-service

# JWKS should return keys (RS256 working)
curl http://localhost:8000/api/v1/auth/.well-known/jwks.json

# All healthcare routes should be reachable (were invisible before)
curl http://localhost:8000/api/v1/healthcare/patients/  # 401 (auth required) = GOOD
curl http://localhost:8000/api/v1/healthcare/doctors/   # 401 = GOOD
```

---

### Step 10 — Commit and push

```bash
cd backend
git add -A
git commit -m "fix: enterprise-grade backend hardening

- BUG-1: Fix nginx upstream (was pointing to non-existent gateway service)
- BUG-2/3/4: Fix backend.shared.* import paths throughout
- BUG-5/6: Add 8 missing redis_client functions (rate_limit_check, blacklist_token, etc.)
- BUG-7: Redis-backed CircuitBreaker (was in-memory, broken on Cloud Run scaling)
- BUG-8: Remove double-prefix partner routes from healthcare-core main.py
- BUG-9: Standardize JWT on RS256+JWKS throughout (remove HS256 mixed usage)
- BUG-10: Add twilio to auth-service requirements.txt
- BUG-11: Add python-jose to healthcare-core requirements.txt
- BUG-12: Add lifespan+init_redis to auth-service and healthcare-core main.py
- BUG-13: Fix ai-service requirements (duplicate dep, add sqlalchemy/asyncpg)
- SEC-1: Fail hard if INTERNAL_SERVICE_SECRET is default in production
- SEC-3: Add auth-service/.env to .gitignore, remove from git history
- ARCH-1: Register all 25+ core routes in healthcare-core api/router.py
- ARCH-2: Add notification-service to docker-compose.yml
- ARCH-5: Fix WebSocket routing in nginx to healthcare-core
- PERF-1: Increase DB pool_size 10->20, max_overflow 20->40 for Cloud Run
- PERF-2: Add max_connections=50 to Redis pool
- PERF-3: nginx worker_processes=auto, worker_connections=4096, epoll
- QUAL-1: Replace jose imports with PyJWT in rbac.py
"
git push origin main
```

---

## Files Changed Summary

| File | Bug Fixed |
|---|---|
| `shared/redis_client.py` | BUG-5, BUG-6, BUG-12, PERF-2 |
| `shared/utils/circuit_breaker.py` | BUG-2, BUG-7 |
| `shared/utils/event_bus.py` | BUG-2 |
| `shared/utils/service_auth.py` | BUG-3, SEC-1 |
| `shared/startup_checks.py` | ARCH-4, SEC-1 |
| `shared/alerting.py` | ARCH-3 (moved from backend/app/) |
| `auth-service/app/main.py` | BUG-12, QUAL-2 |
| `auth-service/app/core/security.py` | BUG-9 |
| `auth-service/requirements.txt` | BUG-10 |
| `healthcare-core/app/main.py` | BUG-8, BUG-12 |
| `healthcare-core/app/api/router.py` | ARCH-1 |
| `healthcare-core/app/api/internal.py` | BUG-3 |
| `healthcare-core/app/middleware/rbac.py` | BUG-11, QUAL-1 |
| `healthcare-core/app/config/settings.py` | BUG-9 |
| `healthcare-core/app/core/database.py` | PERF-1 |
| `healthcare-core/requirements.txt` | BUG-11 |
| `healthcare-core/.../doctor_extensions.py` | BUG-4 (one-line sed fix) |
| `ai-service/requirements.txt` | BUG-13 |
| `nginx/nginx.conf` | BUG-1, ARCH-5, PERF-3, PERF-4 |
| `infra/docker-compose.yml` | BUG-1, ARCH-2 |
| `infra/docker-compose.dev.yml` | BUG-9, ARCH-2 |
