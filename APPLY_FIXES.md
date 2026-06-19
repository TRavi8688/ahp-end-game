# Hospyn Security Fixes — Apply Guide

All files in this directory are drop-in replacements or additions for the
`TRavi8688/ahp-end-game` repository. Follow the steps in order.

---

## DAY 1 — Emergency (do these before anything else)

### Step 1: Purge enc.key from git history
```bash
chmod +x purge_secrets_from_history.sh
./purge_secrets_from_history.sh
```
This uses `git-filter-repo` to rewrite all commits and remove `enc.key`
and `create_admin.py` from every commit in history, then force-pushes.

### Step 2: Rotate secrets
```bash
# Set your GCP project
export GCP_PROJECT_ID=your-project-id
chmod +x rotate_secrets.sh
./rotate_secrets.sh
```
Generates a new Fernet key + JWT secret and pushes both to GCP Secret Manager.

### Step 3: Replace .gitignore and .dockerignore
```bash
cp .gitignore /path/to/your/repo/.gitignore
cp .dockerignore /path/to/your/repo/.dockerignore
```

### Step 4: Replace create_admin.py
```bash
# Delete the old one
rm /path/to/your/repo/create_admin.py
# Copy the safe version
cp create_admin_safe.py /path/to/your/repo/create_admin_safe.py
# To create a superadmin:
ADMIN_EMAIL=admin@hospital.com ADMIN_PASSWORD=YourStr0ngPass! DATABASE_URL=... python3 create_admin_safe.py
```

---

## DAY 2 — Critical one-liners

### Replace start_api.py
```bash
cp start_api.py /path/to/your/repo/start_api.py
```
Fixes: CORS wildcard, PYTHONPATH separator, shell=True, startup sleep, no-auth gateway.

### Replace Dockerfiles
```bash
cp Dockerfile /path/to/your/repo/Dockerfile
cp Dockerfile.gateway /path/to/your/repo/Dockerfile.gateway
```
Fixes: enc.key baked in, root user in gateway, no HEALTHCHECK.

### Replace .env.example
```bash
cp .env.example /path/to/your/repo/.env.example
```

---

## DAYS 3–5 — Database migration

### Replace docker-compose.yml
```bash
cp docker-compose.yml /path/to/your/repo/docker-compose.yml
```
Fixes: SQLite → PostgreSQL, Redis auth, no exposed Redis port.

### Create your .env from the example
```bash
cp .env.example /path/to/your/repo/.env
# Edit .env and fill in all CHANGE_ME values
```

### Replace entrypoint.sh
```bash
cp entrypoint.sh /path/to/your/repo/entrypoint.sh
chmod +x /path/to/your/repo/entrypoint.sh
```

### Run database migrations
```bash
cd /path/to/your/repo
docker-compose up postgres -d
alembic upgrade head
```

### Re-encrypt PHI with new key (if real patient data exists)
```bash
OLD_FERNET_KEY=<old_compromised_key> \
NEW_FERNET_KEY=<new_key_from_secret_manager> \
DATABASE_URL=postgresql+asyncpg://... \
python3 scripts/reencrypt_phi.py
```

---

## WEEK 2

### Add config validation (startup rejects weak secrets)
```bash
mkdir -p /path/to/your/repo/backend/auth-service/app/core/
mkdir -p /path/to/your/repo/backend/healthcare-core/app/core/
cp app/core/config.py /path/to/your/repo/backend/auth-service/app/core/config.py
cp app/core/config.py /path/to/your/repo/backend/healthcare-core/app/core/config.py
```

### Replace nginx.conf
```bash
cp nginx.conf /path/to/your/repo/nginx.conf
```

---

## WEEKS 3–4 — Compliance

### Add DPDP Alembic migration
```bash
cp alembic/versions/001_dpdp_compliance.py /path/to/your/repo/alembic/versions/
alembic upgrade head
```

### Add audit service
```bash
cp app/services/audit_service.py /path/to/your/repo/backend/healthcare-core/app/services/
cp app/services/audit_service.py /path/to/your/repo/backend/auth-service/app/services/
```

### Replace backup.sh
```bash
cp backup.sh /path/to/your/repo/backup.sh
chmod +x /path/to/your/repo/backup.sh
# Set GCS_BUCKET in .env: GCS_BUCKET=gs://your-bucket-name
```

---

## WEEK 4 — Testing

### Add test suite
```bash
cp pytest.ini /path/to/your/repo/pytest.ini
cp tests/conftest.py /path/to/your/repo/tests/conftest.py
cp tests/test_auth.py /path/to/your/repo/tests/test_auth.py
# Update the import at the top of test_auth.py to your actual app path
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

---

## Files NOT changed (still need manual work)
- `backend/` app source (inaccessible for audit — add JWT RS256 migration yourself)
- `alembic.ini` — verify it points to PostgreSQL, not SQLite
- Firebase config — clarify which auth system is canonical
- `scripts/` — add red team and chaos tests
- Missing services: billing, pharmacy, lab, notifications

---

## Verification checklist after applying all fixes
- [ ] `enc.key` not present in repo or Docker image
- [ ] `docker-compose up` uses PostgreSQL (check logs for `asyncpg`)
- [ ] Redis requires password (test: `redis-cli ping` without `-a` fails)
- [ ] Gateway returns 401 for requests without Authorization header
- [ ] App refuses to start if SECRET_KEY contains "supersecretkey"
- [ ] App refuses to start if FERNET_KEY is the old compromised key
- [ ] `backup.sh` uploads to GCS successfully
- [ ] `pytest tests/` passes
- [ ] `alembic upgrade head` creates consent_records and audit_logs tables
