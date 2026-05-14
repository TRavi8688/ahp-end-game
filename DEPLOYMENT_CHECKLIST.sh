#!/bin/bash
# QUICK DEPLOYMENT CHECKLIST
# Use this to verify everything is ready before deployment
# Run: bash DEPLOYMENT_CHECKLIST.sh

echo "================================"
echo "AHP 2.0 PRE-DEPLOYMENT CHECKLIST"
echo "================================"
echo ""

PASS=0
FAIL=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

echo "=== PHASE 1: SECRETS ==="
echo ""

# Check 1: .env not in git
if git log --all --oneline | grep -q "\.env\|Remove.*env"; then
    check_fail ".env history found in git (use: git filter-branch)"
else
    check_pass ".env not in recent git history"
fi

# Check 2: .env file exists (for local dev reference only)
if [ -f ".env" ]; then
    check_warn ".env exists locally (should not be in git)"
else
    check_warn ".env missing (should exist for local development)"
fi

# Check 3: .gitignore includes .env
if grep -q "^\.env$" .gitignore; then
    check_pass ".env in .gitignore"
else
    check_fail ".env NOT in .gitignore"
fi

# Check 4: Verify no secrets in .env.example
if grep -q "BEGIN PRIVATE KEY\|SuperSecret\|cccccccc" .env.example 2>/dev/null; then
    check_fail "Secrets found in .env.example (should be sanitized)"
else
    check_pass ".env.example looks clean"
fi

echo ""
echo "=== PHASE 2: CONFIGURATION ==="
echo ""

# Check 5: DEBUG setting
if grep -q "DEBUG=False" app/core/config.py 2>/dev/null || grep -q "DEBUG.*False" railway.toml 2>/dev/null; then
    check_pass "DEBUG=False configured"
else
    check_fail "DEBUG not set to False"
fi

# Check 6: ENVIRONMENT setting
if grep -q "ENVIRONMENT=production" railway.toml 2>/dev/null || grep -q "ENVIRONMENT.*production" app/core/config.py 2>/dev/null; then
    check_pass "ENVIRONMENT=production configured"
else
    check_fail "ENVIRONMENT not set to production"
fi

# Check 7: CORS not hardcoded to localhost
if grep -q "localhost\|127.0.0.1" app/core/config.py 2>/dev/null && ! grep -q "https://" app/core/config.py 2>/dev/null; then
    check_fail "CORS still hardcoded to localhost"
else
    check_pass "CORS appears to be production-ready"
fi

# Check 8: railway.toml exists
if [ -f "railway.toml" ]; then
    check_pass "railway.toml exists"
else
    check_fail "railway.toml missing"
fi

echo ""
echo "=== PHASE 3: BACKEND ==="
echo ""

# Check 9: FastAPI main.py exists
if [ -f "app/main.py" ]; then
    check_pass "app/main.py exists"
else
    check_fail "app/main.py missing"
fi

# Check 10: Health endpoints defined
if grep -q "GET /health\|GET /healthz\|def health" app/main.py 2>/dev/null; then
    check_pass "Health check endpoints defined"
else
    check_fail "Health check endpoints missing"
fi

# Check 11: Docker setup
if [ -f "Dockerfile" ]; then
    check_pass "Dockerfile exists"
else
    check_fail "Dockerfile missing"
fi

if [ -f "docker-compose.yml" ]; then
    check_pass "docker-compose.yml exists"
else
    check_fail "docker-compose.yml missing"
fi

# Check 12: Database configuration
if grep -q "DATABASE_URL\|postgresql" app/core/config.py 2>/dev/null || grep -q "sqlalchemy" pyproject.toml 2>/dev/null; then
    check_pass "Database configured with SQLAlchemy"
else
    check_fail "Database configuration unclear"
fi

# Check 13: Alembic migrations
if [ -d "alembic" ] && [ -f "alembic.ini" ]; then
    check_pass "Alembic migrations setup exists"
else
    check_fail "Alembic migrations missing"
fi

echo ""
echo "=== PHASE 4: FRONTEND ==="
echo ""

# Check 14: Doctor app ready
if [ -d "doctor-app" ] && [ -f "doctor-app/package.json" ]; then
    check_pass "doctor-app exists with package.json"
    
    if [ -f "doctor-app/vercel.json" ]; then
        check_pass "doctor-app has vercel.json"
    else
        check_fail "doctor-app missing vercel.json"
    fi
else
    check_fail "doctor-app not properly configured"
fi

# Check 15: Patient app ready
if [ -d "patient-app" ] && [ -f "patient-app/package.json" ]; then
    check_pass "patient-app exists with package.json"
else
    check_fail "patient-app not properly configured"
fi

echo ""
echo "=== PHASE 5: WORKERS ==="
echo ""

# Check 16: Worker configuration
if [ -d "app/workers" ]; then
    check_pass "app/workers directory exists"
    
    if [ -f "app/workers/arq_worker.py" ] || grep -q "arq\|celery" pyproject.toml 2>/dev/null; then
        check_pass "Task queue worker configured"
    else
        check_warn "Worker settings unclear"
    fi
else
    check_fail "app/workers directory missing"
fi

# Check 17: Redis configuration
if grep -q "redis\|arq" pyproject.toml 2>/dev/null || grep -q "REDIS\|redis:" docker-compose.yml 2>/dev/null; then
    check_pass "Redis/queue system configured"
else
    check_fail "Redis configuration missing"
fi

echo ""
echo "=== PHASE 6: TESTING ==="
echo ""

# Check 18: Test setup
if [ -d "tests" ]; then
    check_pass "tests/ directory exists"
    
    if [ -f "pytest.ini" ] || grep -q "pytest" pyproject.toml 2>/dev/null; then
        check_pass "pytest configured"
    else
        check_warn "pytest config unclear"
    fi
else
    check_fail "No tests directory"
fi

# Check 19: Poetry for dependencies
if [ -f "pyproject.toml" ] && [ -f "poetry.lock" ]; then
    check_pass "Poetry dependency management setup"
else
    check_fail "Poetry files missing"
fi

echo ""
echo "=== PHASE 7: DOCUMENTATION ==="
echo ""

# Check 20: README
if [ -f "README.md" ]; then
    check_pass "README.md exists"
else
    check_fail "README.md missing"
fi

# Check 21: Deployment docs
if [ -f "DEPLOYMENT_READINESS_AUDIT.md" ] || [ -f "docs/DEPLOYMENT.md" ]; then
    check_pass "Deployment documentation exists"
else
    check_warn "Deployment documentation missing"
fi

echo ""
echo "================================"
echo "RESULTS"
echo "================================"
echo -e "✓ PASSED: ${GREEN}${PASS}${NC}"
echo -e "✗ FAILED: ${RED}${FAIL}${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED - READY FOR DEPLOYMENT REVIEW${NC}"
    exit 0
elif [ $FAIL -le 3 ]; then
    echo -e "${YELLOW}⚠ SOME CHECKS FAILED - REVIEW REQUIRED${NC}"
    exit 1
else
    echo -e "${RED}✗ MULTIPLE FAILURES - DO NOT DEPLOY${NC}"
    exit 2
fi
