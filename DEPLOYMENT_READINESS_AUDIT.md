# 🚨 DEPLOYMENT READINESS AUDIT - AHP 2.0

**Status**: ⚠️ **NOT READY FOR PRODUCTION DEPLOYMENT**

**Date**: May 7, 2026  
**Audit Level**: Comprehensive  
**Critical Issues**: 6  
**Security Issues**: 8  
**Operational Issues**: 5  

---

## ⚠️ CRITICAL BLOCKERS (MUST FIX BEFORE DEPLOYMENT)

### 🔴 1. EXPOSED SECRETS IN VERSION CONTROL
**Severity**: CRITICAL  
**Location**: `.env` file  
**Issue**: The `.env` file contains production secrets and is committed to git:
- JWT Private Key (RSA key pair)
- Database password: `SuperSecretPassword123!`
- Encryption Key: Hardcoded in plaintext
- GCP Project credentials

```
FOUND SECRETS:
- JWT_PRIVATE_KEY (RSA 2048-bit)
- JWT_PUBLIC_KEY (RSA 2048-bit)
- DB_PASSWORD="SuperSecretPassword123!"
- ENCRYPTION_KEY="cccc..." (32 chars hardcoded)
```

**Fix Required**:
1. ✅ **Remove `.env` from git immediately**:
   ```bash
   git rm --cached .env
   git add .gitignore
   git commit -m "Remove exposed secrets from version control"
   ```

2. ✅ **Use Secret Management** (Choose ONE):
   - [Railway Secrets](https://railway.app/docs/guides/security#secrets) (Recommended)
   - [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
   - [HashiCorp Vault](https://www.vaultproject.io/)
   - [1Password Business Secrets Manager](https://developer.1password.com/docs/service-accounts)

3. ✅ **Generate NEW secrets** (your current ones are exposed):
   ```bash
   # New JWT secrets
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   
   # New encryption key
   openssl rand -hex 32
   
   # New database password
   # Use: https://generate.plus/en/strong-password
   ```

4. ✅ **Update `.env.example`** to show format without values:
   ```env
   DB_PASSWORD=        # GENERATE STRONG PASSWORD (min 20 chars)
   JWT_PRIVATE_KEY=    # Generate with: openssl genrsa 2048
   JWT_PUBLIC_KEY=     # Generate with: openssl rsa -in private.pem -pubout
   ENCRYPTION_KEY=     # Generate with: openssl rand -hex 32
   ```

---

### 🔴 2. DEBUG MODE ENABLED IN PRODUCTION
**Severity**: CRITICAL  
**Location**: `.env` file, line `DEBUG=True`  
**Issue**: Debug mode exposes sensitive stack traces and implementation details

**Fix Required**:
```env
# WRONG (Current)
DEBUG=True
ENVIRONMENT=development

# RIGHT (Production)
DEBUG=False
ENVIRONMENT=production
```

**Impact**: Setting `DEBUG=False` prevents FastAPI from exposing:
- Full exception stack traces to clients
- API documentation endpoints (`/docs`, `/redoc`)
- Detailed error messages

---

### 🔴 3. HARDCODED LOCALHOST ORIGINS
**Severity**: CRITICAL  
**Location**: `.env` file, `ALLOWED_ORIGINS`  
**Issue**: CORS is set to localhost, which means production frontend cannot communicate with production API

```env
# WRONG (Current)
ALLOWED_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]

# RIGHT (Production)
ALLOWED_ORIGINS=["https://doctor.mulajna.com", "https://patient.mulajna.com", "https://app.mulajna.com"]
```

**Impact**: Production users will get CORS errors when calling API from frontend

---

### 🔴 4. DATABASE CREDENTIALS EXPOSED
**Severity**: CRITICAL  
**Issue**: DB credentials in plaintext in `.env`
- Username: `ahpadmin`
- Password: `SuperSecretPassword123!` (Weak, exposed)

**Fix Required**:
1. Generate new strong database password:
   ```bash
   openssl rand -base64 32
   # Example output: h8K2mP9vQ4xRsT5uW7yZaB3cD6eF1gJ2kL4nM6oP8q
   ```

2. Update PostgreSQL password in production database
3. Rotate password in Railway/AWS every 90 days

---

### 🔴 5. FRONTEND APPS NOT FULLY DEPLOYED
**Severity**: CRITICAL  
**Status**: Incomplete  
**Issue**: `patient-app` and `doctor-app` exist but deployment status unclear

**What's missing**:
- [ ] Vercel deployment configuration (partial)
- [ ] SPA routing configuration
- [ ] Environment variables for frontend apps
- [ ] CDN/Static hosting setup
- [ ] Build optimization

**Fix Required**:

**For Doctor Frontend** (`doctor-app`):
```bash
cd doctor-app
npm install
npm run build
# Verify dist/ folder is created
vercel --prod
```

**For Patient Frontend** (`patient-app`):
```bash
cd patient-app
npm install
npm run build  # Or: expo export
# Patient app is Expo-based, needs different deployment:
# Option 1: Expo Go (Development)
# Option 2: EAS Build + Expo Updates (Production)
```

---

### 🔴 6. WORKER PROCESS NOT CLEARLY DEFINED FOR PRODUCTION
**Severity**: CRITICAL  
**Location**: Implementation plan mentions separation, but unclear in railway.toml
**Issue**: Background worker tasks (OCR, AI processing) may not run in production

**Current State**:
- ✓ `arq` is configured for async tasks
- ✓ Redis is available
- ✗ Worker deployment is not defined for Railway
- ✗ Celery/arq command is not specified in railway.toml

**Fix Required**:

Update `railway.toml`:
```toml
[build]
builder = "DOCKERFILE"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4"
healthcheckPath = "/health"
```

**Then in Railway Dashboard**:
1. Create a second service for the worker pointing to same repo
2. Override start command: `arq app.workers.arq_worker.WorkerSettings`
3. Ensure worker has access to same `REDIS_URL` and `DATABASE_URL`

---

## 🔒 SECURITY ISSUES (MUST REVIEW)

### Issue 1: No Rate Limiting on Auth Endpoints
**Severity**: HIGH  
**Status**: Implemented but verify limits  
**Fix**: Ensure `slowapi` limits are appropriate:
```python
@limiter.limit("5/minute")  # Login attempts
@limiter.limit("3/minute")  # Registration
```

---

### Issue 2: CORS Origins Set to Wildcard Equivalent
**Severity**: HIGH  
**Current**: Hardcoded known hosts (good)  
**Verify**: No `allow_origins=["*"]` anywhere

```bash
grep -r "allow_origins=\[\"*\"\]" app/
# Should return: no results
```

---

### Issue 3: No HTTPS Enforcement
**Severity**: HIGH  
**Missing**: HTTP → HTTPS redirect middleware

**Add to `app/main.py`**:
```python
@app.middleware("http")
async def https_redirect(request, call_next):
    if request.url.scheme == "http" and settings.ENVIRONMENT == "production":
        return RedirectResponse(url=request.url.replace(scheme="https"), status_code=301)
    return await call_next(request)
```

---

### Issue 4: No Content Security Policy (CSP) Headers
**Severity**: MEDIUM  
**Missing**: CSP headers for XSS protection

**Add to response headers**:
```python
def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response
```

---

### Issue 5: No API Versioning Strategy
**Severity**: MEDIUM  
**Current**: No version prefix  
**Recommendation**: Use `/v1/` prefix:
```python
app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(patient.router, prefix="/api/v1/patient")
```

---

### Issue 6: No Request Signing (For Third-Party Integrations)
**Severity**: MEDIUM  
**If Applicable**: If calling third-party APIs, add HMAC signing

---

### Issue 7: Sentry DSN Not Set
**Severity**: MEDIUM  
**Status**: Checked in code but not in `.env`  
**Missing From** `.env.example`:
```env
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/project_id
```

**Add to Railway Secrets**:
```bash
railway env add SENTRY_DSN https://your-sentry-dsn
```

---

### Issue 8: No Secrets Rotation Policy
**Severity**: MEDIUM  
**Missing**: No documented secrets rotation schedule  
**Recommendation**: Rotate every 90 days:
- JWT secrets
- Database password
- API keys (Gemini, Groq, Claude)
- Encryption keys

---

## ⚠️ OPERATIONAL ISSUES

### Issue 1: Health Check Endpoints Incomplete
**Status**: Partial  
**Current**: `GET /healthz` and `GET /readyz` exist  
**Missing**: 
- [ ] Database connectivity check in readiness probe
- [ ] Redis connectivity check
- [ ] Worker health status

**Recommended Readiness Probe**:
```python
@app.get("/readyz")
async def readiness():
    checks = {
        "database": False,
        "redis": False,
        "workers": False
    }
    
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except:
        pass
    
    try:
        await redis_client.ping()
        checks["redis"] = True
    except:
        pass
    
    if all(checks.values()):
        return {"status": "ready", **checks}
    return {"status": "degraded", **checks}, 503
```

---

### Issue 2: No Database Migration Strategy
**Severity**: MEDIUM  
**Current**: Alembic configured  
**Missing**: 
- [ ] Pre-deployment migration safety checks
- [ ] Rollback strategy documented
- [ ] Zero-downtime migration plan

**Add migration check to CI/CD**:
```bash
# Before deployment:
alembic current  # Show current migration
alembic heads    # Show latest migration
# Run in staging first
```

---

### Issue 3: No Container Registry Setup
**Severity**: MEDIUM  
**Issue**: Docker builds happen locally each deploy  
**Recommendation**: 
- [ ] Use Railway's built-in registry (if available)
- [ ] Or: AWS ECR, Docker Hub
- [ ] Tag builds with version: `ahp:v1.0.0`, `ahp:latest`

---

### Issue 4: Load Testing Not Documented
**Severity**: MEDIUM  
**Missing**: No performance baseline  
**Recommendation**: Run before production:
```bash
# Using locust or k6
k6 run tests/load-test.js  # endpoints_per_sec, response_time, error_rate
```

---

### Issue 5: Logging Not Centralized
**Severity**: MEDIUM  
**Current**: Structured JSON logging to stdout  
**Recommendation**: Send logs to:
- [ ] ELK Stack (Elasticsearch, Logstash, Kibana)
- [ ] Datadog
- [ ] New Relic
- [ ] CloudWatch (if AWS)

**Add to `.env.example`**:
```env
LOG_LEVEL=INFO
LOG_FORMAT=json
```

---

## 📋 CODE QUALITY & BEST PRACTICES

### Good Practices Found ✅
- Layered architecture (Repository/Service pattern)
- Structured logging with `structlog`
- SQLAlchemy 2.0 with types
- Async/await for I/O
- Proper use of Pydantic V2
- Health check endpoints
- Request ID tracking

### Issues to Address ⚠️

1. **Magic Strings in Code**
   - Move configuration to `core/config.py`
   - Use environment variables

2. **Test Coverage**
   - `tests/` folder exists
   - Run: `pytest --cov=app tests/` to check coverage
   - **Target**: Minimum 70% coverage for critical paths

3. **Type Hints**
   - Ensure all functions have return types
   - Consider adding: `mypy --strict app/`

4. **Documentation**
   - API docs: `/docs` (enabled in dev, disabled in prod)
   - Missing: Architecture decision records (ADRs)
   - Missing: Deployment runbook

---

## ✅ PRE-DEPLOYMENT CHECKLIST

**CRITICAL (Do Not Deploy Without These)**:
- [ ] **Remove `.env` from git** (use Railway/AWS secrets)
- [ ] **Set `DEBUG=False`**
- [ ] **Update `ALLOWED_ORIGINS` to production domains**
- [ ] **Generate and rotate new secrets** (JWT, DB password, encryption key)
- [ ] **Define worker process in railway.toml**
- [ ] **Deploy frontend apps** (doctor-app, patient-app)
- [ ] **Database migration tested** in staging
- [ ] **Health endpoints verified**

**HIGH PRIORITY** (Within 1 week):
- [ ] Add HTTPS redirect middleware
- [ ] Add Security headers (CSP, X-Frame-Options)
- [ ] Set up Sentry for error tracking
- [ ] Centralize logging (Datadog/ELK)
- [ ] Document rollback procedures
- [ ] Run load tests (ensure 1000+ concurrent)
- [ ] Set up monitoring alerts (CPU, Memory, Errors)

**MEDIUM PRIORITY** (Within 1 month):
- [ ] Implement secrets rotation policy
- [ ] API versioning strategy
- [ ] Comprehensive integration tests
- [ ] Performance optimization
- [ ] User acceptance testing (UAT)

---

## 🚀 RECOMMENDED DEPLOYMENT ARCHITECTURE

```
Production Environment:
┌─────────────────────────────────────────────────────────┐
│                    Internet Users                        │
└────────────────────────┬────────────────────────────────┘
                         │
                    ┌────▼────────────────┐
                    │  Vercel CDN         │ (Doctor/Patient Apps)
                    │  + CloudFlare WAF   │
                    └────┬────────────────┘
                         │
                    ┌────▼────────────────┐
                    │  Nginx Reverse Proxy│ (SSL/TLS)
                    │  Load Balancer      │
                    └────┬────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
┌────▼───┐          ┌────▼───┐          ┌────▼───┐
│API Pod1 │          │API Pod2 │          │API Pod3 │
│(uvicorn)│          │(uvicorn)│          │(uvicorn)│
└────┬───┘          └────┬───┘          └────┬───┘
     │                   │                   │
     └───────────────────┼───────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼──┐  ┌────────▼──┐  ┌──────▼────┐
    │PostgreSQL  │   Redis    │  │ S3 Bucket │
    │ (Primary)  │ (Cache)    │  │ (Storage) │
    └───────────┘ └───────────┘  └───────────┘
          │
    ┌─────▼───────────────┐
    │ Replica (backup)    │
    └─────────────────────┘

Async Workers:
┌────────────────────────────────────┐
│  ARQ Worker Pool (2-4 instances)   │
│  - OCR Processing                  │
│  - AI Summarization                │
│  - Document Upload                 │
└────────────────────────────────────┘
     │
     └─► Redis Queue
     └─► S3 Uploads
     └─► PostgreSQL Updates
```

---

## 📞 DEPLOYMENT CONTACTS & ESCALATION

| Component | Responsible | Escalation | Backup |
|-----------|------------|-----------|--------|
| API Backend | DevOps | CTO | Senior Engineer |
| Database | DBA | Infrastructure Lead | DBA2 |
| Secrets Management | Security | CISO | Sr. Security |
| Frontend Hosting | Frontend Lead | Product | Frontend2 |
| Monitoring | DevOps | CTO | On-call |

---

## 📺 MONITORING DASHBOARD SETUP

**Metrics to Monitor**:
- API Response Time (p50, p95, p99)
- Error Rate (5xx, 4xx)
- Database Connection Pool Usage
- Redis Memory Usage
- Worker Queue Depth
- CPU/Memory Usage per Pod

**Recommended Tools**:
1. **Sentry** - Error tracking
2. **Datadog** - APM & Monitoring
3. **New Relic** - Performance monitoring
4. **Prometheus** - Metrics collection
5. **Grafana** - Visualization

---

## ⏱️ DEPLOYMENT TIMELINE

```
Phase 1: Security Fixes (1-2 days)
├─ Remove secrets from git
├─ Generate new credentials
├─ Set up secret management
└─ Add security headers

Phase 2: Infrastructure (2-3 days)
├─ Deploy to Railway/AWS
├─ Set up staging environment
├─ Configure monitoring
└─ Test health checks

Phase 3: Testing (3-5 days)
├─ Smoke tests
├─ Integration tests
├─ Load tests
├─ UAT with stakeholders
└─ Penetration testing

Phase 4: Go-live (1 day)
├─ Final checklist
├─ Canary deployment (10% traffic)
├─ Monitor for errors
└─ Full rollout (if no errors)

Estimated Total: 2 weeks
```

---

## 📝 SUMMARY

**Current Status**: Development-grade, not production-ready  
**Blocking Issues**: 6 critical  
**Estimated Fix Time**: 2-3 weeks  
**Risk Level**: 🔴 HIGH (go-live will fail without fixes)  
**Recommendation**: **DO NOT DEPLOY** until all CRITICAL issues resolved

**Next Steps**:
1. Fix secrets exposure immediately (4 hours)
2. Update configuration for production (2 hours)
3. Deploy frontend apps (1-2 days)
4. Set up monitoring (2-3 days)
5. Run full test suite (1-2 days)
6. Staging environment validation (1-3 days)

---

**Audit Completed By**: AI Code Audit System  
**Review Date**: May 7, 2026  
**Next Audit**: After critical fixes (May 15, 2026)
