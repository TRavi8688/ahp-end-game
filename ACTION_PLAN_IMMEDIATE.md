# 🎯 IMMEDIATE ACTION PLAN - URGENT TASKS

## Priority Queue: **CRITICAL → HIGH → MEDIUM**

---

## 🔴 PHASE 1: SECURITY LOCKDOWN (DO FIRST - TODAY)
**Estimated Time**: 4 hours  
**Owner**: DevOps/Security

### Task 1.1: Remove Exposed Secrets from Git
**Status**: NOT STARTED  
**Effort**: 30 minutes

```bash
# Step 1: Remove .env from git history
git filter-branch --tree-filter 'rm -f .env' HEAD
# OR use: git gc to repack

# Step 2: Add .env to .gitignore (should already be there)
echo ".env" >> .gitignore
echo ".env.*.local" >> .gitignore

# Step 3: Commit
git add .gitignore
git commit -m "SECURITY: Remove .env with exposed secrets"

# Step 4: Verify .env is not in any commits
git log --all --full-history -- ".env"
# Should show: "fatal: pathspec '.env' did not match any files"

# Step 5: Force push (WARNING: only if this is the only repo)
git push origin --force-with-lease
```

**Verification**:
```bash
# Ensure no secrets visible in history
git diff HEAD~1 | grep -i "password\|secret\|key"
# Should return: no results
```

---

### Task 1.2: Generate NEW Secrets (Your Current Ones Are Exposed)
**Status**: NOT STARTED  
**Effort**: 20 minutes

#### Generate JWT Key Pair
```bash
# Create new RSA 2048-bit key pair
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Display the keys (copy to Railway secrets)
cat private_key.pem
cat public_key.pem

# Store these keys ONLY in Railway/AWS Secrets Manager
# Delete these files from disk after copying:
rm private_key.pem public_key.pem
```

#### Generate Encryption Key
```bash
# Create 32-byte encryption key (256-bit for AES-256)
openssl rand -base64 32
# Example output: "h8K2mP9vQ4xRsT5uW7yZaB3cD6eF1gJ2kL4nM6oP8qQ=="
```

#### Generate New Database Password
```bash
# Create 20+ character password (strong)
openssl rand -base64 20
# Example: "xY8aB2cD4eF6gH8jK0lM2n"
# OR use: https://generate.plus/en/strong-password
```

---

### Task 1.3: Set Up Railway Secrets Manager
**Status**: NOT STARTED  
**Effort**: 15 minutes

**Steps**:
1. Go to [Railway Dashboard](https://railway.app/project)
2. Select your project
3. Go to **Environment** → **Variables**
4. Add the following (using values from Task 1.2):

```
DB_PASSWORD = <new-strong-password>
JWT_PRIVATE_KEY = <your-new-private-key>
JWT_PUBLIC_KEY = <your-new-public-key>
ENCRYPTION_KEY = <your-new-encryption-key>
ENVIRONMENT = production
DEBUG = False
ALLOWED_ORIGINS = ["https://doctor.mulajna.com", "https://patient.mulajna.com"]
SENTRY_DSN = <your-sentry-project-dsn>
```

**Verification**:
```bash
# Test that Railway variables are set (after deployment)
railway env ls
# Should show all var names (values hidden)
```

---

### Task 1.4: Update `.env.example` (Safe Version to Commit)
**Status**: NOT STARTED  
**Effort**: 10 minutes

```bash
# Create safe version without secrets
cat > .env.example << 'EOF'
# --- DATABASE ---
DB_USER=ahpadmin
DB_PASSWORD=              # GENERATE: openssl rand -base64 20
DB_NAME=ahp_prod
DB_HOST=db
DB_PORT=5432
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# --- REDIS ---
REDIS_URL=redis://redis:6379/0

# --- SECURITY (CRITICAL) ---
# Generate these using: openssl rand -hex 32
ACCESS_TOKEN_SECRET=      # Min 32 chars
REFRESH_TOKEN_SECRET=     # Min 32 chars, UNIQUE from above
ENCRYPTION_KEY=           # 32 bytes (base64)
JWT_PRIVATE_KEY=          # Generate: openssl genrsa -out private.pem 2048
JWT_PUBLIC_KEY=           # Generate: openssl rsa -in private.pem -pubout

# --- CORS (UPDATE FOR PRODUCTION) ---
ALLOWED_ORIGINS=["https://doctor.mulajna.com", "https://patient.mulajna.com"]

# --- APP SETTINGS ---
ENVIRONMENT=production
DEBUG=False
PROJECT_NAME="AHP 2.0 Secure"

# --- OPTIONAL: OBSERVABILITY ---
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/project
LOG_LEVEL=INFO
EOF

# Commit safe version
git add .env.example
git commit -m "docs: Update .env.example with secure template (no secrets)"
```

---

## 🔴 PHASE 2: CONFIGURATION UPDATES (HOURS 4-6)
**Estimated Time**: 2 hours  
**Owner**: Backend Lead

### Task 2.1: Fix `DEBUG` and `ENVIRONMENT` Settings
**Status**: NOT STARTED  
**Effort**: 10 minutes

**File**: `app/core/config.py`

```bash
# Ensure this is correct:
grep -n "DEBUG\|ENVIRONMENT" app/core/config.py

# Expected:
# DEBUG = Field(default=False)  ← Should be False in production
# ENVIRONMENT = Field(default="production")
```

### Task 2.2: Update CORS Origins for Production
**Status**: NOT STARTED  
**Effort**: 15 minutes

**File**: `app/core/config.py` (or where ALLOWED_ORIGINS is set)

```python
# Before:
ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

# After (update with real domains):
ALLOWED_ORIGINS = [
    "https://doctor.mulajna.com",
    "https://doctor.mulajna.com:443",
    "https://patient.mulajna.com",
    "https://patient.mulajna.com:443",
    "https://app.mulajna.com"
]
```

### Task 2.3: Add HTTPS Redirect Middleware
**Status**: NOT STARTED  
**Effort**: 10 minutes

**File**: `app/main.py` (add this middleware)

```python
@app.middleware("http")
async def https_redirect(request: Request, call_next):
    """Redirect HTTP to HTTPS in production."""
    if settings.ENVIRONMENT == "production":
        if request.url.scheme == "http":
            url = request.url.replace(scheme="https")
            return RedirectResponse(url=url, status_code=301)
    return await call_next(request)
```

**Add above the `/health` endpoints** (around line 100 in main.py)

---

## 🟠 PHASE 3: FRONTEND DEPLOYMENT (HOURS 6-8)
**Estimated Time**: 2-4 hours  
**Owner**: Frontend Lead

### Task 3.1: Deploy Doctor Frontend
**Status**: NOT STARTED  
**Effort**: 30-60 minutes

```bash
cd doctor-app

# Install dependencies
npm install

# Build optimized version
npm run build

# Test build locally
npm run preview

# Deploy to Vercel (recommended)
npm install -g vercel
vercel --prod

# OR: Docker build
docker build -t doctor-app:latest .
docker push <your-registry>/doctor-app:latest
```

**Verify**:
```bash
# After deployment, check:
curl https://doctor.mulajna.com/health
# Expected: 200 OK
```

---

### Task 3.2: Deploy Patient Frontend
**Status**: NOT STARTED  
**Effort**: 60-90 minutes (more complex)

```bash
cd patient-app

# Install dependencies
npm install
# OR: yarn install (see package.json)

# Build for web
npm run build  # or: expo export

# Option A: Expo Go (development only)
npm start

# Option B: EAS Build + Vercel (production)
# Install EAS CLI
npm install -g eas-cli

# Initialize
eas build --platform web

# Deploy to Vercel
npm install -g vercel
vercel --prod
```

**For React Native Production**:
- Use: [EAS (Expo Application Services)](https://docs.expo.dev/eas/)
- Or: [Fastlane](https://fastlane.tools/) for iOS/Android

---

## 🟠 PHASE 4: WORKER SETUP (HOURS 8-10)
**Estimated Time**: 2 hours  
**Owner**: DevOps

### Task 4.1: Configure Worker Process in `railway.toml`
**Status**: NOT STARTED  
**Effort**: 20 minutes

**File**: `railway.toml` (create/update)

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
# For the API service
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4"
healthcheckPath = "/healthz"
healthcheckTimeout = 10
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
numReplicas = 2
maxConcurrency = 1000

# Expose this port
ports = [{ port = 8000, type = "http" }]

[env]
PYTHONUNBUFFERED = "1"
```

**Commit this**:
```bash
git add railway.toml
git commit -m "config: Add railway.toml with API configuration"
```

---

### Task 4.2: Create Worker Service in Railway Dashboard
**Status**: NOT STARTED  
**Effort**: 30 minutes

**Steps**:
1. Go to [Railway Dashboard](https://railway.app)
2. Select your project
3. Click **+ New Service** → **GitHub Repo**
4. Select the same AHP repository
5. Name it: `ahp-worker`
6. Link to same PostgreSQL & Redis services
7. **Under Deploy tab**: Override the start command:
```bash
arq app.workers.arq_worker.WorkerSettings
```

8. Set environment variables (same as API):
```
DATABASE_URL
REDIS_URL
ENCRYPTION_KEY
(+ all other secrets)
```

9. Set replicas to 2 (for redundancy)
10. Click Deploy

**Verify**:
```bash
# Check worker logs in Railway dashboard
# Should see: "Worker started" or similar message
```

---

## 🟡 PHASE 5: MONITORING & OBSERVABILITY (HOURS 10-12)
**Estimated Time**: 2 hours  
**Owner**: DevOps/Backend

### Task 5.1: Set Up Sentry Error Tracking
**Status**: NOT STARTED  
**Effort**: 30 minutes

**Steps**:
1. Go to [Sentry.io](https://sentry.io)
2. Create new project → Python → FastAPI
3. Copy DSN (looks like: `https://xxx@yyy.ingest.sentry.io/123456`)
4. Add to Railway secrets:
```bash
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/123456
```

5. Code already initializes Sentry in `app/main.py` ✓

**Verify**:
```bash
# Trigger test error (after deployment)
curl https://api.mulajna.com/test-error
# Check Sentry dashboard for the error
```

---

### Task 5.2: Set Up Application Monitoring
**Status**: NOT STARTED  
**Effort**: 60 minutes (optional but recommended)

**Choose ONE**:

**Option A: Datadog** (Recommended for comprehensive monitoring)
```bash
# Install datadog agent in container
# Modify Dockerfile to add datadog-agent
```

**Option B: New Relic**
```python
# In app/main.py before initialization
import newrelic.agent
newrelic.agent.initialize()  # reads NEW_RELIC_CONFIG_FILE
```

**Option C: Prometheus + Grafana** (Open source)
```python
# Already partially set up in app/core/metrics.py
# Expose metrics at GET /metrics
```

---

## 🟡 PHASE 6: TESTING & VALIDATION (HOURS 12-16)
**Estimated Time**: 4 hours  
**Owner**: QA/Backend

### Task 6.1: Run Smoke Tests
**Status**: NOT STARTED  
**Effort**: 30 minutes

```bash
# Test the basic health checks
curl -i https://api.mulajna.com/healthz
curl -i https://api.mulajna.com/readyz

# Test authentication
curl -X POST https://api.mulajna.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'

# Test CORS headers
curl -i -H "Origin: https://doctor.mulajna.com" \
  https://api.mulajna.com/healthz
# Should see: Access-Control-Allow-Origin header
```

### Task 6.2: Run Unit & Integration Tests
**Status**: NOT STARTED  
**Effort**: 60 minutes

```bash
# Run test suite
pytest tests/ -v

# With coverage report
pytest tests/ --cov=app --cov-report=html

# Check coverage is > 70% for critical paths
```

### Task 6.3: Load Test (Optional but Recommended)
**Status**: NOT STARTED  
**Effort**: 90 minutes

```bash
# Install k6
# Download from https://k6.io/download/

# Create test script tests/load-test.js
# Run: k6 run tests/load-test.js
```

**Expected results**:
- p95 response time < 500ms
- Error rate < 0.1%
- Can handle 1000+ concurrent users

---

## ✅ PRE-DEPLOYMENT VERIFICATION
**Status**: NOT STARTED  
**Effort**: 30 minutes

```bash
# Use this checklist before clicking "Deploy"

# 1. Secrets check
echo "✓ Secrets removed from git"
git log --all --oneline | grep -i "secret\|remove.*env"

# 2. Environment check
railway env ls | grep "DEBUG\|ENVIRONMENT\|ALLOWED_ORIGINS"

# 3. Database check
railway run psql -U ahpadmin -d ahp_prod -c "SELECT version();"

# 4. Redis check
railway run redis-cli ping

# 5. API health check
railway run curl http://localhost:8000/healthz

# 6. Frontend checks
curl https://doctor.mulajna.com
curl https://patient.mulajna.com

# 7. Worker check
railway logs -s ahp-worker | head -20

# All checks passed? ✅ READY TO DEPLOY
```

---

## 📋 DEPLOYMENT COMMAND (FINAL STEP)

```bash
# Once all above tasks are complete:

# 1. Final git push
git push origin main

# 2. Railway deploys automatically (if webhooks enabled)
# OR manually deploy:
railway deploy

# 3. Monitor deployment
railway logs

# 4. Monitor errors
# Check Sentry dashboard
# Check Railway metrics

# 5. Verify production
curl https://api.mulajna.com/healthz
curl https://doctor.mulajna.com
curl https://patient.mulajna.com

# 6. Rollback (if needed)
railway rollback  # Reverts to previous version
```

---

## 🚨 DEPLOYMENT RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Database migration fails | Data loss | Test on staging first |
| Worker doesn't start | AI jobs blocked | Check logs, have rollback ready |
| Frontend can't reach API | Users blocked | Check CORS, DNS, firewall |
| Secrets not set | Auth broken | Verify Railway env vars |
| High error rate | Service unavailable | Rollback to previous version |
| Database password wrong | Auth fails | Verify DB_PASSWORD in secrets |

---

## 📞 ESCALATION CONTACTS

- **Backend Issues**: DevOps Lead @slack
- **Database Issues**: DBA @slack
- **Frontend Issues**: Frontend Lead @slack
- **Security Issues**: Security Team @slack
- **On-Call**: Check PagerDuty

---

## ✅ SIGN-OFF CHECKLIST

**Before deployment, obtain approval from**:
- [ ] CTO/Tech Lead
- [ ] DevOps Lead
- [ ] Security Lead
- [ ] Product Manager
- [ ] QA Lead

---

**Total Estimated Time**: 2-3 weeks  
**Critical Path Items**: Phases 1-3 (MUST DO)  
**Can-do-later Items**: Phases 5-6 (should do within 1 month)  

**DO NOT DEPLOY WITHOUT COMPLETING PHASE 1 & 2**

---

Last Updated: May 7, 2026
