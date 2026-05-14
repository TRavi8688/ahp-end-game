# ✅ PRODUCTION DEPLOYMENT CHECKLIST - 100/100 READY

**Target**: 100/100 Production Readiness  
**Date**: May 7, 2026  
**Owner**: DevOps/Backend Team  

---

## 🎯 PHASE 1: SECURITY & SECRETS (Critical Path)

### ✅ Secrets Removal & Generation

- [ ] **1.1 Remove .env from Git History**
  ```bash
  # Command to run locally
  git filter-branch --tree-filter 'rm -f .env' HEAD
  git push origin --force-with-lease
  
  # Verify
  git log --all --oneline -- ".env" | wc -l  # Should be 0
  ```
  - [ ] Completed and verified
  - [ ] All team members pulled updated history

- [ ] **1.2 Generate All Production Secrets** (See [SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md))
  ```bash
  # 1. JWT Key Pair
  openssl genrsa -out jwt_private.pem 2048
  openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
  
  # 2. Encryption Key (32 bytes)
  openssl rand -base64 32
  
  # 3. Secret Key (32 chars min)
  openssl rand -hex 32
  
  # 4. Database Password (20+ chars)
  openssl rand -base64 20
  ```
  - [ ] JWT_PRIVATE_KEY generated
  - [ ] JWT_PUBLIC_KEY generated
  - [ ] ENCRYPTION_KEY generated
  - [ ] SECRET_KEY generated
  - [ ] DB_PASSWORD generated
  - [ ] All files deleted from local disk

- [ ] **1.3 Add Secrets to Railway**
  - [ ] Go to https://railway.app → Project → API service
  - [ ] Click Variables tab
  - [ ] Add all 15+ secrets (see .env.example)
  - [ ] Mark sensitive where supported
  - [ ] Save and trigger redeploy
  - [ ] Verify no errors in logs

### ✅ Configuration Updates

- [ ] **1.4 Verify app/core/config.py**
  ```bash
  grep -n "DEBUG\|ENVIRONMENT\|validate_production_safety" app/core/config.py
  ```
  - [ ] DEBUG field present
  - [ ] validate_production_safety validator present
  - [ ] All production safety checks enforced

- [ ] **1.5 Verify app/core/database.py**
  ```bash
  grep -n "SSL verification" app/core/database.py
  ```
  - [ ] SSL verification ENABLED in production
  - [ ] SSL verification DISABLED in development

- [ ] **1.6 Verify app/main.py**
  ```bash
  grep -n "security_headers_middleware\|https_redirect_middleware" app/main.py
  ```
  - [ ] Security headers middleware added
  - [ ] HTTPS redirect middleware added
  - [ ] HSTS header configured

- [ ] **1.7 Update .env.example**
  - [ ] No actual secrets in .env.example
  - [ ] All required fields documented
  - [ ] Generation commands included
  - [ ] Committed to git ✓

---

## 🎯 PHASE 2: CONFIGURATION & INFRASTRUCTURE

### ✅ Railway Configuration

- [ ] **2.1 Update railway.toml**
  ```bash
  cat railway.toml | grep -A 5 "\[deploy\]"
  ```
  - [ ] Build config correct
  - [ ] Start command with 4 workers
  - [ ] Health check path: `/healthz`
  - [ ] Restart policy: ON_FAILURE
  - [ ] Number of replicas: 2 (HA)

- [ ] **2.2 Configure API Service in Railway**
  - [ ] Service name: "api"
  - [ ] Link PostgreSQL database
  - [ ] Link Redis cache
  - [ ] All 15+ variables set
  - [ ] Health check working
  - [ ] Can see logs without errors

### ✅ Frontend Configuration

- [ ] **2.3 Doctor App Vercel Config**
  ```bash
  cat doctor-app/vercel.json | grep -A 3 "buildCommand"
  ```
  - [ ] vercel.json exists
  - [ ] Build command correct
  - [ ] SPA routing configured
  - [ ] Security headers added
  - [ ] Cache-Control headers added

- [ ] **2.4 Patient App Vercel Config**
  ```bash
  cat patient-app/vercel.json | grep -A 3 "buildCommand"
  ```
  - [ ] vercel.json exists
  - [ ] Build command correct
  - [ ] SPA routing configured
  - [ ] Security headers added

### ✅ Worker Configuration

- [ ] **2.5 Configure Worker Service**
  - [ ] Go to Railway → "+ New Service"
  - [ ] Name: "ahp-worker"
  - [ ] Link same GitHub repo
  - [ ] Override start command: `arq app.workers.arq_worker.WorkerSettings`
  - [ ] Link same PostgreSQL and Redis
  - [ ] Set all environment variables
  - [ ] Set replicas to 2
  - [ ] Verify worker starts without errors

---

## 🎯 PHASE 3: FRONTEND DEPLOYMENT

### ✅ Doctor App Deployment

- [ ] **3.1 Build Doctor App**
  ```bash
  cd doctor-app
  npm install
  npm run build
  # Verify dist/ folder created
  ls -la dist/
  ```
  - [ ] npm install succeeded
  - [ ] npm run build succeeded
  - [ ] dist/ folder has files
  - [ ] index.html present
  - [ ] No build errors

- [ ] **3.2 Deploy to Vercel**
  ```bash
  npm install -g vercel
  vercel --prod
  ```
  - [ ] Deployed to Vercel
  - [ ] Production URL active
  - [ ] Can access https://doctor.yourdomain.com
  - [ ] No 404 errors on refresh (SPA routing works)

### ✅ Patient App Deployment

- [ ] **3.3 Build Patient App**
  ```bash
  cd patient-app
  npm install
  npm run build
  # Verify dist/ folder created
  ls -la dist/
  ```
  - [ ] npm install succeeded
  - [ ] npm run build succeeded
  - [ ] dist/ folder has files
  - [ ] index.html present
  - [ ] No build errors

- [ ] **3.4 Deploy to Vercel**
  ```bash
  vercel --prod
  ```
  - [ ] Deployed to Vercel
  - [ ] Production URL active
  - [ ] Can access https://patient.yourdomain.com
  - [ ] No 404 errors on refresh (SPA routing works)

---

## 🎯 PHASE 4: MONITORING & OBSERVABILITY

### ✅ Error Tracking

- [ ] **4.1 Set up Sentry**
  - [ ] Create Sentry.io project
  - [ ] Copy DSN
  - [ ] Add SENTRY_DSN to Railway variables
  - [ ] Redeploy API service
  - [ ] Check logs: "Sentry Observability Enabled"
  - [ ] Verify errors appear in Sentry dashboard

### ✅ Health Checks

- [ ] **4.2 Test Liveness Probe**
  ```bash
  curl -i https://api.yourdomain.com/healthz
  # Expected: 200 OK
  # Response: {"status": "alive", "timestamp": "..."}
  ```
  - [ ] Returns 200 OK
  - [ ] Returns JSON with status
  - [ ] Responds within 1 second

- [ ] **4.3 Test Readiness Probe**
  ```bash
  curl -i https://api.yourdomain.com/readyz
  # Expected: 200 OK
  # Response: {"status": "ready", "timestamp": "..."}
  ```
  - [ ] Returns 200 OK
  - [ ] Database is reachable
  - [ ] Redis is reachable

### ✅ Logging

- [ ] **4.4 Verify Structured Logging**
  - [ ] Railway logs show JSON format
  - [ ] Logs include timestamps
  - [ ] Logs include request IDs
  - [ ] No plaintext secrets in logs

---

## 🎯 PHASE 5: TESTING & VALIDATION

### ✅ Smoke Tests

- [ ] **5.1 API Endpoints**
  ```bash
  # Test authentication
  curl -X POST https://api.yourdomain.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test123"}'
  # Expected: Returns token or 401
  
  # Test with valid token
  curl -i -H "Authorization: Bearer TOKEN" \
    https://api.yourdomain.com/api/v1/patient/profile
  # Expected: 200 OK or 401 (depending on user)
  ```
  - [ ] Auth endpoint responds
  - [ ] Can receive JWT token
  - [ ] Protected endpoints require auth

- [ ] **5.2 CORS Headers**
  ```bash
  curl -i -H "Origin: https://doctor.yourdomain.com" \
    https://api.yourdomain.com/healthz
  # Expected: Access-Control-Allow-Origin header present
  ```
  - [ ] CORS headers present
  - [ ] Correct origin allowed
  - [ ] Credentials header present

- [ ] **5.3 Security Headers**
  ```bash
  curl -i https://api.yourdomain.com/healthz | grep -i "X-\|Content-Security\|Strict"
  # Expected: Multiple security headers
  ```
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] Content-Security-Policy present
  - [ ] Strict-Transport-Security present (production)

- [ ] **5.4 HTTPS Redirect**
  ```bash
  curl -i http://api.yourdomain.com/healthz
  # Expected: 301 redirect to https://
  ```
  - [ ] HTTP redirects to HTTPS
  - [ ] Status code: 301
  - [ ] Location header has https://

### ✅ Functional Tests

- [ ] **5.5 Run Unit Tests**
  ```bash
  pytest tests/ -v --cov=app
  # Expected: > 70% coverage, all tests pass
  ```
  - [ ] All tests pass
  - [ ] Coverage > 70%
  - [ ] No warnings

- [ ] **5.6 Run Integration Tests**
  ```bash
  pytest tests/integration/ -v
  ```
  - [ ] Database operations work
  - [ ] API calls return expected results
  - [ ] Error handling works

### ✅ Performance Tests

- [ ] **5.7 Load Test Setup**
  ```bash
  # Create tests/load-test.js (see k6 documentation)
  k6 run tests/load-test.js
  # Expected: p95 < 500ms, error rate < 0.1%
  ```
  - [ ] API handles 1000+ concurrent users
  - [ ] Response time p95 < 500ms
  - [ ] Error rate < 0.1%
  - [ ] No memory leaks
  - [ ] Database connection pool OK

- [ ] **5.8 Database Performance**
  ```bash
  # Connect to database and check
  # SELECT count(*) FROM pg_stat_statements;
  # Look for slow queries (execution_time > 1000ms)
  ```
  - [ ] No N+1 queries
  - [ ] Query times reasonable
  - [ ] Indexes optimized

---

## 🎯 PHASE 6: APPROVALS & SIGN-OFF

### ✅ Stakeholder Reviews

- [ ] **6.1 Security Review**
  - [ ] Security lead reviewed:
    - [ ] Secrets management (✓ in Railway, ✓ not in git)
    - [ ] SSL verification (✓ enabled in prod)
    - [ ] Security headers (✓ all present)
    - [ ] HTTPS enforcement (✓ redirects)
    - [ ] JWT configuration (✓ RSA keys set)
  - [ ] Signed off: ___________________

- [ ] **6.2 DevOps Review**
  - [ ] DevOps lead reviewed:
    - [ ] Railway configuration (✓ 2 replicas, health checks)
    - [ ] Worker setup (✓ separate service, linked dependencies)
    - [ ] Database backup (✓ configured)
    - [ ] Monitoring (✓ Sentry, logs)
    - [ ] Scaling limits (✓ set appropriately)
  - [ ] Signed off: ___________________

- [ ] **6.3 Backend Lead Review**
  - [ ] Backend lead reviewed:
    - [ ] Code changes (✓ config, middleware)
    - [ ] Database migrations (✓ tested)
    - [ ] API endpoints (✓ working)
    - [ ] Error handling (✓ proper logging)
    - [ ] Performance (✓ load tested)
  - [ ] Signed off: ___________________

- [ ] **6.4 Product Manager Review**
  - [ ] Product lead reviewed:
    - [ ] Features ready (✓ backend, ✓ frontend)
    - [ ] User experience (✓ login/auth works)
    - [ ] Performance (✓ acceptable for users)
    - [ ] Monitoring (✓ can track errors)
  - [ ] Signed off: ___________________

- [ ] **6.5 QA Lead Review**
  - [ ] QA lead reviewed:
    - [ ] Test results (✓ all tests pass)
    - [ ] Coverage (✓ > 70%)
    - [ ] Load test results (✓ meets SLA)
    - [ ] Security tests (✓ headers, CORS, HTTPS)
  - [ ] Signed off: ___________________

---

## 🎯 PHASE 7: PRODUCTION DEPLOYMENT

### ✅ Pre-Deployment

- [ ] **7.1 Final System Check**
  ```bash
  # Run automated checklist
  bash DEPLOYMENT_CHECKLIST.sh
  ```
  - [ ] All checks pass (exit code 0)
  - [ ] No warnings
  - [ ] All components green

- [ ] **7.2 Backup Database**
  ```bash
  # Take snapshot of production database
  # In Railway: Data → Backups → Create
  ```
  - [ ] Database backup created
  - [ ] Backup verified restorable
  - [ ] Backup location documented

- [ ] **7.3 Verify Rollback Plan**
  ```bash
  # Know how to rollback:
  # 1. railway rollback (API service)
  # 2. railway rollback (Worker service)
  # 3. Vercel revert frontend deploy
  ```
  - [ ] Rollback command documented
  - [ ] Team trained on rollback
  - [ ] Can execute in < 5 minutes

- [ ] **7.4 On-Call Team Ready**
  - [ ] Primary on-call: ___________________
  - [ ] Secondary on-call: ___________________
  - [ ] Escalation path defined
  - [ ] Communication channel open (Slack, PagerDuty)

### ✅ Deployment Execution

- [ ] **7.5 Canary Deployment (10% Traffic)**
  - [ ] Deploy API service
  - [ ] Route 10% production traffic
  - [ ] Monitor for 30 minutes
    - [ ] Error rate < 1%
    - [ ] Response times normal
    - [ ] No database issues
  - [ ] If OK: Proceed to full deployment

- [ ] **7.6 Full Deployment (100% Traffic)**
  - [ ] Route 100% traffic to new version
  - [ ] Monitor closely for 1 hour
    - [ ] Error rate remains < 1%
    - [ ] Performance metrics normal
    - [ ] User complaints? (None received)
  - [ ] If OK: Deployment successful!

- [ ] **7.7 Post-Deployment Validation**
  ```bash
  # Final verification
  curl https://api.yourdomain.com/healthz  # Should 200 OK
  curl https://doctor.yourdomain.com       # Should load
  curl https://patient.yourdomain.com      # Should load
  ```
  - [ ] API health check passes
  - [ ] Doctor app loads
  - [ ] Patient app loads
  - [ ] No errors in Sentry

---

## 🎯 PHASE 8: ONGOING MONITORING (24 Hours Post-Deployment)

### ✅ Real-Time Monitoring

- [ ] **8.1 Error Rate Monitoring**
  - [ ] Sentry dashboard active
  - [ ] Error rate < 1%
  - [ ] No critical errors
  - [ ] Team notified of all errors

- [ ] **8.2 Performance Monitoring**
  - [ ] API response time p95 < 500ms
  - [ ] Database queries running fast
  - [ ] No memory leaks
  - [ ] CPU usage normal (< 70%)

- [ ] **8.3 User Traffic Monitoring**
  - [ ] Expected traffic levels observed
  - [ ] Authentication working
  - [ ] No unusual patterns
  - [ ] Successfully processing jobs

- [ ] **8.4 Availability Monitoring**
  - [ ] Both API instances healthy
  - [ ] Worker instances processing tasks
  - [ ] Database responsive
  - [ ] Redis cache working
  - [ ] All external services up

### ✅ Manual Testing (First Day)

- [ ] **8.5 User Workflows**
  - [ ] Doctor login works
  - [ ] Patient login works
  - [ ] Can upload documents
  - [ ] AI processing works
  - [ ] Can generate reports
  - [ ] Email notifications sent

- [ ] **8.6 Edge Cases**
  - [ ] Large file upload works
  - [ ] Session timeout works
  - [ ] Error messages helpful
  - [ ] Mobile responsive works
  - [ ] Slow network handled gracefully

---

## 📊 FINAL READINESS SCORE

```
Use this formula to calculate final score:

Phase 1 (Security):        ___ / 20 points
Phase 2 (Infrastructure):  ___ / 20 points
Phase 3 (Frontend):        ___ / 15 points
Phase 4 (Monitoring):      ___ / 15 points
Phase 5 (Testing):         ___ / 20 points
Phase 6 (Approvals):       ___ / 5 points
Phase 7 (Deployment):      ___ / 4 points
Phase 8 (Monitoring):      ___ / 1 point

TOTAL SCORE: ___ / 100

✅ 95-100: EXCELLENT - Ready for production, full rollout
✅ 85-94:  GOOD - Ready for production with caution
⚠️  70-84:  OK - Requires monitoring, may need fixes
❌ <70:    NOT READY - Fix issues before deploying
```

---

## 🎉 DEPLOYMENT SUCCESS CRITERIA

**All of the following must be TRUE:**

- [x] All checklist items completed
- [x] All tests passing
- [x] All approvals signed off
- [x] Error rate < 1%
- [x] No security alerts
- [x] Team trained on runbook
- [x] Rollback plan ready
- [x] On-call team in place

**Once all above are complete:**
```
STATUS: ✅ 100/100 PRODUCTION READY
TIME: Deploy immediately! 🚀
```

---

## 📞 SUPPORT DURING DEPLOYMENT

**If things go wrong:**

1. **Check Sentry Dashboard**: https://sentry.io → ahp-prod
2. **Check Railway Logs**: https://railway.app → API service → Logs tab
3. **Check Health**: `curl https://api.yourdomain.com/readyz`
4. **Escalate**: Contact on-call engineer
5. **Rollback**: `railway rollback`

**Key Contacts:**
- Backend Lead: ___________________
- DevOps Lead: ___________________
- Security Lead: ___________________
- Product Manager: ___________________

---

**Deployment Checklist Version**: 1.1  
**Last Updated**: May 7, 2026  
**Next Review**: After first production week
