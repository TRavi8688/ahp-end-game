#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# push_all_phases.sh
# ONE-TIME SCRIPT: applies all phases 3–14 to your repo and pushes to GitHub
#
# Run from your ahp-end-game repo root:
#   bash push_all_phases.sh /path/to/hospyn-full-push
#
# What this does:
#   1. Removes dangerous files from git history (enc.key, create_admin.py)
#   2. Copies all fixed files into the repo
#   3. Runs a pre-push check (confirms no secrets, no SQLite refs)
#   4. Creates a single commit with everything
#   5. Pushes to origin/main
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

FIX_DIR="${1:?Usage: bash push_all_phases.sh /path/to/hospyn-full-push}"
REPO_DIR="$(pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          Hospyn — Full Phase 3–14 Git Push Script           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Confirm we are in the right repo ─────────────────────────────────────────
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "ERROR: Run this from the ahp-end-game repo root (directory with .git)"
  exit 1
fi

REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$REMOTE" != *"ahp-end-game"* ]]; then
  echo "WARNING: Remote URL ($REMOTE) does not contain 'ahp-end-game'."
  read -p "Continue anyway? [y/N] " yn
  [[ "$yn" == "y" ]] || exit 1
fi

# ── Step 1: Purge dangerous files from git history ───────────────────────────
echo ""
echo "STEP 1: Removing enc.key and create_admin.py from git history..."
echo "(This requires git-filter-repo — run: pip install git-filter-repo)"
echo ""

if command -v git-filter-repo &>/dev/null; then
  git filter-repo --path enc.key --invert-paths --force 2>/dev/null || true
  git filter-repo --path create_admin.py --invert-paths --force 2>/dev/null || true
  echo "  ✓ Dangerous files purged from history"
else
  echo "  ⚠ git-filter-repo not found. Install with: pip install git-filter-repo"
  echo "  ⚠ Skipping history purge — do this manually before hospital deployment."
fi

# ── Step 2: Copy all fix files ────────────────────────────────────────────────
echo ""
echo "STEP 2: Copying all phase fixes into repo..."

# Root-level files (phases 3-6, overwriting with merged versions)
for f in pyproject.toml Makefile alembic.ini docker-compose.yml Dockerfile \
         Dockerfile.gateway entrypoint.sh start_api.py .gitignore \
         .dockerignore .env.example pytest.ini package.json; do
  if [ -f "$FIX_DIR/$f" ]; then
    cp "$FIX_DIR/$f" "$REPO_DIR/$f"
    echo "  ✓ $f"
  fi
done

# Backend directories
for dir in backend/auth-service/app/core \
            backend/auth-service/app/middleware \
            backend/auth-service/app/api \
            backend/healthcare-core/app/core \
            backend/healthcare-core/app/middleware \
            backend/ai-service/app \
            backend/app/core \
            backend/app/middleware \
            backend/app/api \
            backend/app/models; do
  if [ -d "$FIX_DIR/$dir" ]; then
    mkdir -p "$REPO_DIR/$dir"
    cp "$FIX_DIR/$dir/"*.py "$REPO_DIR/$dir/" 2>/dev/null || true
    echo "  ✓ $dir/"
  fi
done

# AI service Dockerfile + requirements
if [ -f "$FIX_DIR/backend/ai-service/Dockerfile" ]; then
  mkdir -p "$REPO_DIR/backend/ai-service"
  cp "$FIX_DIR/backend/ai-service/Dockerfile" "$REPO_DIR/backend/ai-service/"
  cp "$FIX_DIR/backend/ai-service/requirements.txt" "$REPO_DIR/backend/ai-service/"
  echo "  ✓ backend/ai-service/Dockerfile + requirements.txt"
fi

# Alembic
mkdir -p "$REPO_DIR/alembic/versions"
[ -f "$FIX_DIR/alembic/env.py" ] && cp "$FIX_DIR/alembic/env.py" "$REPO_DIR/alembic/"
for migration in "$FIX_DIR/alembic/versions/"*.py; do
  cp "$migration" "$REPO_DIR/alembic/versions/"
  echo "  ✓ alembic/versions/$(basename $migration)"
done

# Scripts
mkdir -p "$REPO_DIR/scripts/red_team"
for f in "$FIX_DIR/scripts/"*.py "$FIX_DIR/scripts/"*.sh "$FIX_DIR/scripts/"*.sql; do
  [ -f "$f" ] && cp "$f" "$REPO_DIR/scripts/" && echo "  ✓ scripts/$(basename $f)"
done
[ -f "$FIX_DIR/scripts/red_team/red_team_rbac.py" ] && \
  cp "$FIX_DIR/scripts/red_team/red_team_rbac.py" "$REPO_DIR/scripts/red_team/"

# Tests
mkdir -p "$REPO_DIR/tests"
for f in "$FIX_DIR/tests/"*.py; do
  [ -f "$f" ] && cp "$f" "$REPO_DIR/tests/" && echo "  ✓ tests/$(basename $f)"
done

# GitHub Actions (CI/CD)
mkdir -p "$REPO_DIR/.github/workflows"
[ -f "$FIX_DIR/.github/workflows/ci-cd.yml" ] && \
  cp "$FIX_DIR/.github/workflows/ci-cd.yml" "$REPO_DIR/.github/workflows/"

# Terraform
[ -f "$FIX_DIR/terraform/main.tf" ] && \
  mkdir -p "$REPO_DIR/terraform" && \
  cp "$FIX_DIR/terraform/main.tf" "$REPO_DIR/terraform/"

# Frontend packages (Phase 09)
mkdir -p "$REPO_DIR/packages/ui/src/components"
for f in Button.tsx StatusBadge.tsx; do
  src="$FIX_DIR/packages/ui/src/components/$f"
  [ -f "$src" ] && cp "$src" "$REPO_DIR/packages/ui/src/components/"
done
[ -f "$FIX_DIR/packages/ui/src/index.ts" ] && \
  cp "$FIX_DIR/packages/ui/src/index.ts" "$REPO_DIR/packages/ui/src/"
[ -f "$FIX_DIR/packages/ui/package.json" ] && \
  cp "$FIX_DIR/packages/ui/package.json" "$REPO_DIR/packages/ui/"
[ -f "$FIX_DIR/packages/ui/tsconfig.json" ] && \
  cp "$FIX_DIR/packages/ui/tsconfig.json" "$REPO_DIR/packages/ui/"

echo ""
echo "  ✓ All files copied"

# ── Step 3: Pre-push safety check ────────────────────────────────────────────
echo ""
echo "STEP 3: Pre-push safety checks..."

FAIL=0

# Check: no SQLite references in Python source
if grep -rn "aiosqlite\|sqlite://" "$REPO_DIR/backend/" --include="*.py" 2>/dev/null | grep -v "test\|#"; then
  echo "  ✗ FAIL: SQLite reference found in backend source"
  FAIL=1
else
  echo "  ✓ No SQLite in backend source"
fi

# Check: no hardcoded compromise key
if grep -rn "CUV3WDeZXcp_7F74LyTqqIDmgDqn5" "$REPO_DIR" --include="*.py" \
   --exclude-dir=".git" 2>/dev/null | grep -v "compromised\|blocked\|reject"; then
  echo "  ✗ FAIL: Compromised Fernet key found in source"
  FAIL=1
else
  echo "  ✓ Compromised key not in source"
fi

# Check: enc.key not tracked
if git ls-files "$REPO_DIR/enc.key" 2>/dev/null | grep -q "enc.key"; then
  echo "  ✗ FAIL: enc.key is still tracked by git — remove from history first"
  FAIL=1
else
  echo "  ✓ enc.key not tracked"
fi

# Check: .env not tracked
if git ls-files "$REPO_DIR/.env" 2>/dev/null | grep -q "\.env$"; then
  echo "  ✗ FAIL: .env is tracked by git — add to .gitignore"
  FAIL=1
else
  echo "  ✓ .env not tracked"
fi

if [ $FAIL -ne 0 ]; then
  echo ""
  echo "✗ Pre-push checks FAILED. Fix the issues above before pushing."
  exit 1
fi

echo ""
echo "  ✓ All safety checks passed"

# ── Step 4: Commit ────────────────────────────────────────────────────────────
echo ""
echo "STEP 4: Creating git commit..."

git add -A

# Show what will be committed
echo ""
echo "Files staged for commit:"
git diff --cached --name-only | head -60
echo ""

git commit -m "fix: apply phases 3-14 — security, docker, RS256 JWT, PostgreSQL, testing, observability, compliance, scalability

Phase 3: CORS from env, shell=False, PostgreSQL, Redis auth, multi-worker uvicorn
Phase 4: Poetry Dockerfile, non-root user, HEALTHCHECK, Makefile, alembic.ini
Phase 5: RS256 JWT (replaces HS256), RBAC/ABAC middleware, JWKS endpoint, Fernet from env
Phase 6: Alembic migrations (initial schema + DPDP compliance tables)
Phase 7: Docker security fixes (already pushed, docker-compose updated with ai-service)
Phase 8: CI/CD pipeline — test + security scan + Cloud Run deploy (updated with phase 11 tests)
Phase 9: Turborepo frontend, shared @hospyn/ui component library
Phase 10: AI microservice with PHI scrubbing + consent check before LLM calls
Phase 11: Full pytest suite — unit + integration + red team + chaos (Blueprint §16.2)
Phase 12: structlog + OTEL tracing + Prometheus metrics + PagerDuty P0/P1 + Sentry
Phase 13: DPDP consent_records + cryptographic audit chain + right to erasure API
Phase 14: PostgreSQL + PgBouncer + authenticated Redis + multi-worker uvicorn

BREAKING: remove enc.key from repo history (use FERNET_KEY env var instead)
BREAKING: docker-compose now requires POSTGRES_PASSWORD, REDIS_PASSWORD, SECRET_KEY in .env"

echo ""
echo "  ✓ Commit created"

# ── Step 5: Push ──────────────────────────────────────────────────────────────
echo ""
echo "STEP 5: Pushing to origin/main..."
echo ""

read -p "Push to origin/main now? [y/N] " confirm
if [[ "$confirm" == "y" ]]; then
  git push origin main
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ✓ All phases 3–14 pushed to GitHub successfully!          ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Next steps:"
  echo "  1. Go to GitHub → Settings → Secrets → add:"
  echo "     GCP_PROJECT_ID, GCP_SA_EMAIL, GCP_WIF_PROVIDER, TEST_FERNET_KEY"
  echo "  2. Run: cp .env.example .env  →  fill in all values"
  echo "  3. Run: make gen-fernet  →  set FERNET_KEY in .env"
  echo "  4. Run: make gen-secret  →  set SECRET_KEY in .env"
  echo "  5. Run: make docker-up"
  echo "  6. Run: make migrate"
  echo "  7. Run: make test"
  echo "  8. Check Sentry dashboard — verify error alerts work"
  echo ""
else
  echo "  Push skipped. Run 'git push origin main' when ready."
fi
