# Hospyn Security Fixes — Apply These Files

## What's in this package

Every file in this folder is a **fixed, ready-to-use replacement** for the
corresponding file in your repository. Copy each file over the existing one.

---

## Files and what they fix

| File | What it fixes |
|------|--------------|
| `docker-compose.yml` | SQLite → PostgreSQL; Redis auth; no exposed DB/Redis ports |
| `.env.example` | Removes dangerous default SECRET_KEY; adds REDIS_PASSWORD, SENTRY_DSN |
| `.gitignore` | Adds enc.key, *.key, archive/, store_room/ |
| `.dockerignore` | Stops enc.key and dead code from entering container images |
| `Dockerfile` | Multi-stage build — no `COPY . .`; only app source copied |
| `nginx.conf` | Let's Encrypt cert paths; strict OTP rate limiting |
| `backup.sh` | Encrypted GCS upload; SHA256 checksum; 7-year retention |
| `backend/auth-service/app/core/config.py` | Boot-time rejection of default SECRET_KEY and SQLite |
| `backend/auth-service/app/core/otp_security.py` | OTP brute-force protection (5 attempts → 30-min lockout) |
| `backend/healthcare-core/app/middleware/audit.py` | PHI access audit logging (DPDP compliance) |
| `backend/healthcare-core/app/core/observability.py` | Sentry + Prometheus wiring |
| `scripts/init-db.sh` | Creates both PostgreSQL databases on first boot |
| `.github/workflows/ci.yml` | CI: tests, secret scanning, Docker build verification |
| `tests/` | First real test suite (OTP security + config validation) |
| `pytest.ini` | Proper test config with coverage gate |

---

## Step 1 — Apply the files (5 minutes)

```bash
# Copy all fixed files into your repo
cp docker-compose.yml      /path/to/ahp-end-game/docker-compose.yml
cp .env.example            /path/to/ahp-end-game/.env.example
cp .gitignore              /path/to/ahp-end-game/.gitignore
cp .dockerignore           /path/to/ahp-end-game/.dockerignore
cp Dockerfile              /path/to/ahp-end-game/Dockerfile
cp nginx.conf              /path/to/ahp-end-game/nginx.conf
cp backup.sh               /path/to/ahp-end-game/backup.sh
cp pytest.ini              /path/to/ahp-end-game/pytest.ini
cp scripts/init-db.sh      /path/to/ahp-end-game/scripts/init-db.sh
chmod +x /path/to/ahp-end-game/scripts/init-db.sh
chmod +x /path/to/ahp-end-game/backup.sh

cp backend/auth-service/app/core/config.py \
   /path/to/ahp-end-game/backend/auth-service/app/core/config.py

cp backend/auth-service/app/core/otp_security.py \
   /path/to/ahp-end-game/backend/auth-service/app/core/otp_security.py

cp backend/healthcare-core/app/middleware/audit.py \
   /path/to/ahp-end-game/backend/healthcare-core/app/middleware/audit.py

cp backend/healthcare-core/app/core/observability.py \
   /path/to/ahp-end-game/backend/healthcare-core/app/core/observability.py

cp -r .github/ /path/to/ahp-end-game/.github/
cp -r tests/   /path/to/ahp-end-game/tests/
```

---

## Step 2 — Remove the exposed encryption key (TODAY)

```bash
cd /path/to/ahp-end-game

# Install git-filter-repo
pip install git-filter-repo

# Remove enc.key from ALL git history
git filter-repo --path enc.key --invert-paths --force

# Verify it's gone
git log --all --full-history -- enc.key
# Should return nothing

# Push cleaned history
git push origin --force --all
git push origin --force --tags

# Tell all team members to re-clone:
# git clone https://github.com/TRavi8688/ahp-end-game.git
```

---

## Step 3 — Create your .env file with real secrets

```bash
# Generate strong secrets
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(64))"
python3 -c "import secrets; print('POSTGRES_PASSWORD=' + secrets.token_hex(24))"
python3 -c "import secrets; print('REDIS_PASSWORD=' + secrets.token_hex(32))"

# Create .env from example and fill in the generated values
cp .env.example .env
# Edit .env with your generated values
nano .env
```

---

## Step 4 — Update nginx.conf with your real domain

```bash
# Replace YOUR_DOMAIN.COM with your actual domain in nginx.conf
sed -i 's/YOUR_DOMAIN.COM/api.yourhospyn.com/g' nginx.conf
```

---

## Step 5 — Start the fixed stack

```bash
# Load your .env
export $(cat .env | grep -v '^#' | xargs)

# Start with PostgreSQL + authenticated Redis
docker-compose up -d db redis

# Wait for DB health check (~15 seconds)
sleep 20

# Run migrations
DATABASE_URL="postgresql+asyncpg://hospyn:${POSTGRES_PASSWORD}@localhost:5432/hospyn_auth" \
  alembic upgrade head

DATABASE_URL="postgresql+asyncpg://hospyn:${POSTGRES_PASSWORD}@localhost:5432/hospyn_healthcare" \
  alembic upgrade head

# Start all services
docker-compose up -d
```

---

## Step 6 — Verify the fixes worked

```bash
# Redis should REJECT unauthenticated connections
redis-cli -h localhost -p 6379 ping
# Expected: NOAUTH Authentication required

# enc.key should NOT be in the Docker image
docker build -t hospyn-test .
docker run --rm hospyn-test find /app -name "enc.key"
# Expected: (no output)

# Application should REFUSE to start with default SECRET_KEY
SECRET_KEY="supersecretkey_please_change_in_production_12345" \
  python3 -c "from app.core.config import settings"
# Expected: ValueError: FATAL: SECRET_KEY is set to a known default value

# Tests should run
pip install fakeredis pytest-asyncio pytest-cov
pytest tests/unit/ -v
```

---

## Step 7 — Wire in audit middleware (add to main.py)

In `backend/healthcare-core/app/main.py`, add these two lines after `app = FastAPI(...)`:

```python
from app.middleware.audit import setup_audit_middleware
from app.core.observability import setup_sentry, setup_prometheus
from app.core.config import settings

setup_sentry(settings)          # Must be first
setup_audit_middleware(app)     # PHI audit logging
setup_prometheus(app)           # /metrics endpoint
```

---

## What still needs to be done (90-day plan)

These fixes are not in this package — they require backend schema work:

1. **DPDP Consent tables** — alembic migration for `patient_consents` table
2. **DSAR endpoint** — `GET /patients/me/data-export`
3. **Erasure request endpoint** — `DELETE /patients/me/data`
4. **AI output validation** — confidence gating for triage scoring
5. **Certificate pinning** — in patient-app and doctor-app React Native code
6. **Load tests** — Locust scripts for queue and appointment flows
