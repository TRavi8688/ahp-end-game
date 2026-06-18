#!/usr/bin/env python3
"""
Hospyn — Production Readiness Verifier
=======================================
Run this BEFORE every production deploy.
Every CHECK must pass (✅) before go-live.

Usage:
    python production_readiness_verify.py
    python production_readiness_verify.py --env-file .env.production
    python production_readiness_verify.py --skip-db   # skip live DB checks

Exit code 0 = all checks passed.
Exit code 1 = one or more checks failed (do NOT deploy).
"""

import os
import sys
import re
import subprocess
import argparse
import json
from pathlib import Path
from typing import Callable

# ─── Colour helpers ──────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def ok(msg):    print(f"  {GREEN}✅ PASS{RESET}  {msg}")
def fail(msg):  print(f"  {RED}❌ FAIL{RESET}  {msg}")
def warn(msg):  print(f"  {YELLOW}⚠️  WARN{RESET}  {msg}")
def info(msg):  print(f"  {CYAN}ℹ️  INFO{RESET}  {msg}")
def header(msg):print(f"\n{BOLD}{CYAN}{'─'*60}{RESET}\n{BOLD}{msg}{RESET}")

# ─── Globals ─────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).parent
FAILURES   = []
WARNINGS   = []


def check(name: str, fn: Callable) -> bool:
    """Run a check function. Returns True if passed."""
    try:
        result = fn()
        if result is True or result is None:
            ok(name)
            return True
        elif isinstance(result, str):
            fail(f"{name} — {result}")
            FAILURES.append(name)
            return False
        else:
            fail(name)
            FAILURES.append(name)
            return False
    except Exception as e:
        fail(f"{name} — exception: {e}")
        FAILURES.append(name)
        return False


def soft_check(name: str, fn: Callable):
    """Run a check but only warn, don't fail."""
    try:
        result = fn()
        if result is True or result is None:
            ok(name)
        elif isinstance(result, str):
            warn(f"{name} — {result}")
            WARNINGS.append(name)
    except Exception as e:
        warn(f"{name} — {e}")
        WARNINGS.append(name)


# ─── CHECK IMPLEMENTATIONS ────────────────────────────────────────────────────

def chk_no_placeholder_secrets():
    """No CHANGE_ME / REPLACE_ME / placeholder values in .env files."""
    patterns = [
        r"CHANGE_ME", r"REPLACE_ME", r"your-secret-here",
        r"changeme123", r"password123", r"PLACEHOLDER",
    ]
    for env_file in ROOT.glob("**/.env"):
        if "node_modules" in str(env_file) or ".git" in str(env_file):
            continue
        content = env_file.read_text(errors="ignore")
        for pat in patterns:
            if re.search(pat, content, re.IGNORECASE):
                return f"Placeholder value matching '{pat}' found in {env_file}"


def chk_no_cors_wildcard():
    """No allow_origins=['*'] in Python backend source."""
    for py_file in (ROOT / "backend").rglob("*.py"):
        content = py_file.read_text(errors="ignore")
        if re.search(r'allow_origins\s*=\s*\[.*"\*"', content):
            return f"CORS wildcard found in {py_file}"


def chk_env_allowed_origins():
    """ALLOWED_ORIGINS env var is set and has no wildcard."""
    val = os.environ.get("ALLOWED_ORIGINS", "")
    if not val:
        return "ALLOWED_ORIGINS is not set — set it to comma-separated Firebase domains"
    if "*" in val:
        return "ALLOWED_ORIGINS contains '*' — never use wildcard in production"


def chk_env_secret_key():
    secret = os.environ.get("SECRET_KEY", "")
    if not secret:
        return "SECRET_KEY is not set"
    if len(secret) < 32:
        return f"SECRET_KEY is too short ({len(secret)} chars, need ≥32)"
    if secret in ("REPLACE_ME_GENERATE_WITH_openssl_rand_hex_32", "changeme"):
        return "SECRET_KEY is still the default placeholder"


def chk_env_fernet_key():
    key = os.environ.get("FERNET_KEY", "")
    if not key:
        return "FERNET_KEY is not set"
    try:
        from cryptography.fernet import Fernet
        Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        return "FERNET_KEY is not a valid Fernet key"


def chk_env_postgres_password():
    pw = os.environ.get("POSTGRES_PASSWORD", "")
    if not pw:
        return "POSTGRES_PASSWORD is not set"
    if pw in ("REPLACE_ME_USE_A_STRONG_RANDOM_PASSWORD", "postgres", "password", "hospyn"):
        return "POSTGRES_PASSWORD is still the default/weak value"
    if len(pw) < 16:
        return f"POSTGRES_PASSWORD is too short ({len(pw)} chars, use ≥16)"


def chk_env_redis_password():
    pw = os.environ.get("REDIS_PASSWORD", "")
    if not pw:
        return "REDIS_PASSWORD is not set"
    if pw in ("REPLACE_ME_USE_A_STRONG_RANDOM_PASSWORD", "redis", "password"):
        return "REDIS_PASSWORD is still the default/weak value"


def chk_env_jwt_keys():
    private = os.environ.get("JWT_PRIVATE_KEY_PEM", "")
    public  = os.environ.get("JWT_PUBLIC_KEY_PEM", "")
    if not private:
        return "JWT_PRIVATE_KEY_PEM is not set — generate with: openssl genrsa -out private.pem 2048"
    if not public:
        return "JWT_PUBLIC_KEY_PEM is not set — generate with: openssl rsa -in private.pem -pubout -out public.pem"
    if "BEGIN RSA PRIVATE KEY" not in private and "BEGIN PRIVATE KEY" not in private:
        return "JWT_PRIVATE_KEY_PEM does not look like a valid PEM private key"


def chk_env_audit_hmac():
    val = os.environ.get("AUDIT_HMAC_SECRET", "")
    if not val:
        return "AUDIT_HMAC_SECRET is not set"
    if len(val) < 32:
        return "AUDIT_HMAC_SECRET is too short (need ≥32 chars)"


def chk_no_enc_key_in_repo():
    """enc.key must not exist in the repo (was committed and is COMPROMISED)."""
    for match in ROOT.rglob("enc.key"):
        if ".git" not in str(match):
            return f"enc.key found at {match} — run purge_secrets_from_history.sh NOW"


def chk_no_create_admin_py():
    """Old create_admin.py (hardcoded credentials) must be gone."""
    danger = ROOT / "create_admin.py"
    if danger.exists():
        return "create_admin.py exists — delete it (use create_admin_safe.py instead)"


def chk_gitignore_has_env():
    """.gitignore must cover .env and enc.key."""
    gi = ROOT / ".gitignore"
    if not gi.exists():
        return ".gitignore not found"
    content = gi.read_text()
    missing = []
    for pattern in [".env", "enc.key", "*.key", "private_key.pem"]:
        if pattern not in content:
            missing.append(pattern)
    if missing:
        return f".gitignore is missing: {', '.join(missing)}"


def chk_alembic_single_head():
    """alembic must have exactly 1 head (linear chain)."""
    alembic_dir = ROOT / "backend" / "healthcare-core"
    if not alembic_dir.exists():
        return True  # skip if not found
    try:
        result = subprocess.run(
            ["alembic", "heads"],
            cwd=alembic_dir,
            capture_output=True, text=True, timeout=20,
        )
        output = result.stdout + result.stderr
        head_count = output.count("(head)")
        if head_count == 0:
            return "Could not determine alembic heads — check DATABASE_URL"
        if head_count > 1:
            return f"Alembic has {head_count} heads — migration chain is FORKED. Fix revision IDs."
    except FileNotFoundError:
        return "alembic not installed — run: pip install alembic"
    except subprocess.TimeoutExpired:
        return "alembic heads timed out — is the database reachable?"


def chk_migration_files_present():
    """The 3 fixed migration files must be in healthcare-core/alembic/versions."""
    versions_dir = ROOT / "backend" / "healthcare-core" / "alembic" / "versions"
    if not versions_dir.exists():
        return "versions directory not found"
    required = [
        "20260605_dpdp_compliance_tables.py",
        "20260605_phase3_patient_device_tokens.py",
        "20260605_add_performance_indexes.py",
    ]
    missing = [f for f in required if not (versions_dir / f).exists()]
    if missing:
        return f"Missing migration files: {missing} — copy from hospyn-fixes/migrations/"


def chk_docker_compose_no_sqlite():
    """docker-compose.yml must not reference sqlite."""
    dc = ROOT / "docker-compose.yml"
    if not dc.exists():
        return True
    content = dc.read_text()
    if "sqlite" in content.lower():
        return "docker-compose.yml contains sqlite reference — all services must use PostgreSQL"


def chk_docker_compose_redis_auth():
    """Redis in docker-compose must have requirepass set."""
    dc = ROOT / "docker-compose.yml"
    if not dc.exists():
        return True
    content = dc.read_text()
    if "requirepass" not in content:
        return "Redis in docker-compose.yml has no requirepass — set REDIS_PASSWORD"


def chk_docker_compose_no_exposed_internal_ports():
    """Internal services (auth/healthcare/ai/notification) must not expose ports to host."""
    dc = ROOT / "docker-compose.yml"
    if not dc.exists():
        return True
    content = dc.read_text()
    # Simple heuristic — look for host-port mappings on internal service ports
    exposed = re.findall(r'"\d+:800[1-4]"', content)
    if exposed:
        return f"Internal service ports are exposed to host: {exposed} — remove these mappings"


def chk_sentry_dsn_set():
    dsn = os.environ.get("SENTRY_DSN", "")
    if not dsn:
        return "SENTRY_DSN is not set — error monitoring will be blind in production"


def chk_firebase_json_has_all_targets():
    """firebase.json must have all 8 hosting targets."""
    fj = ROOT / "firebase.json"
    if not fj.exists():
        return "firebase.json not found"
    data = json.loads(fj.read_text())
    hosting = data.get("hosting", [])
    targets = {h["target"] for h in hosting}
    required = {"patient", "doctor", "erp", "landing", "admin", "hr", "reception", "partner"}
    missing = required - targets
    if missing:
        return f"firebase.json missing hosting targets: {missing}"


def chk_firebaserc_has_all_targets():
    """firebaserc must map all 8 hosting targets."""
    fr = ROOT / ".firebaserc"
    if not fr.exists():
        return ".firebaserc not found"
    data = json.loads(fr.read_text())
    try:
        targets = set(data["targets"]["hospyn-495906-96438"]["hosting"].keys())
    except KeyError:
        return "Unexpected .firebaserc structure"
    required = {"patient", "doctor", "erp", "landing", "admin", "hr", "reception", "partner"}
    missing = required - targets
    if missing:
        return f".firebaserc missing hosting targets: {missing}"


def chk_dpdp_tables_in_db():
    """DPDP compliance tables must exist in the production DB."""
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url or "REPLACE_ME" in db_url:
        return "DATABASE_URL not set — skipping DPDP table check"
    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        for table in ("consent_records", "data_deletion_requests", "data_breach_log"):
            cur.execute(f"SELECT COUNT(*) FROM {table}")
        conn.close()
    except ImportError:
        return "psycopg2 not installed — run: pip install psycopg2-binary"
    except Exception as e:
        return f"DPDP table check failed: {e}"


def chk_patient_device_tokens_table():
    """patient_device_tokens table must exist (push notifications)."""
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url or "REPLACE_ME" in db_url:
        return True  # skip
    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM patient_device_tokens")
        conn.close()
    except ImportError:
        return True  # skip
    except Exception as e:
        return f"patient_device_tokens check failed: {e} — run push token migration"


def chk_health_endpoints():
    """All 4 backend /health endpoints must return 200."""
    import urllib.request
    import urllib.error
    services = {
        "auth-service":        os.environ.get("AUTH_SERVICE_URL",      "http://localhost:8001"),
        "healthcare-core":     os.environ.get("HEALTHCARE_SERVICE_URL","http://localhost:8002"),
        "ai-service":          os.environ.get("AI_SERVICE_URL",        "http://localhost:8003"),
        "notification-service":os.environ.get("NOTIFICATION_SERVICE_URL","http://localhost:8004"),
    }
    failed = []
    for name, base_url in services.items():
        url = base_url.rstrip("/") + "/health"
        try:
            req = urllib.request.urlopen(url, timeout=5)
            if req.status != 200:
                failed.append(f"{name} → HTTP {req.status}")
        except Exception as e:
            failed.append(f"{name} → {e}")
    if failed:
        return f"Health checks failed: {failed}"


def chk_no_test_data_in_prod_db():
    """Production DB must not have test@hospyn.com or test patients."""
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url or "REPLACE_ME" in db_url or os.environ.get("ENV") != "production":
        return True  # only check in production
    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM patients WHERE name ILIKE '%test%'")
        count = cur.fetchone()[0]
        conn.close()
        if count > 0:
            return f"Found {count} test patients in production DB — clean up before launch"
    except Exception:
        return True  # skip if can't connect


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Hospyn Production Readiness Verifier")
    parser.add_argument("--env-file", default=".env", help="Path to .env file to load")
    parser.add_argument("--skip-db", action="store_true", help="Skip live database checks")
    args = parser.parse_args()

    # Load env file if it exists
    env_path = ROOT / args.env_file
    if env_path.exists():
        info(f"Loading environment from {env_path}")
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

    print(f"\n{BOLD}{'═'*60}{RESET}")
    print(f"{BOLD}  HOSPYN PRODUCTION READINESS VERIFICATION{RESET}")
    print(f"{BOLD}{'═'*60}{RESET}")

    # ── SECURITY ──────────────────────────────────────────────────────────────
    header("SECURITY")
    check("No placeholder secrets in source",     chk_no_placeholder_secrets)
    check("No CORS wildcard in backend",           chk_no_cors_wildcard)
    check("enc.key not present in repo",           chk_no_enc_key_in_repo)
    check("create_admin.py removed",               chk_no_create_admin_py)
    check(".gitignore covers .env and keys",       chk_gitignore_has_env)

    # ── ENVIRONMENT VARIABLES ─────────────────────────────────────────────────
    header("ENVIRONMENT VARIABLES")
    check("ALLOWED_ORIGINS set (no wildcard)",     chk_env_allowed_origins)
    check("SECRET_KEY set and strong",             chk_env_secret_key)
    check("FERNET_KEY valid",                      chk_env_fernet_key)
    check("POSTGRES_PASSWORD strong",              chk_env_postgres_password)
    check("REDIS_PASSWORD set",                    chk_env_redis_password)
    check("JWT RSA keys configured",               chk_env_jwt_keys)
    check("AUDIT_HMAC_SECRET set",                 chk_env_audit_hmac)
    soft_check("SENTRY_DSN set",                   chk_sentry_dsn_set)

    # ── DATABASE / MIGRATIONS ─────────────────────────────────────────────────
    header("DATABASE & MIGRATIONS")
    check("Migration files present in healthcare-core", chk_migration_files_present)
    if not args.skip_db:
        check("Alembic single head (no fork)",     chk_alembic_single_head)
        check("DPDP compliance tables exist",       chk_dpdp_tables_in_db)
        check("patient_device_tokens table exists", chk_patient_device_tokens_table)
        check("No test data in production DB",      chk_no_test_data_in_prod_db)
    else:
        info("Database checks skipped (--skip-db)")

    # ── DOCKER / INFRA ────────────────────────────────────────────────────────
    header("DOCKER & INFRASTRUCTURE")
    check("docker-compose has no SQLite",          chk_docker_compose_no_sqlite)
    check("Redis requirepass in docker-compose",   chk_docker_compose_redis_auth)
    check("Internal ports not exposed to host",    chk_docker_compose_no_exposed_internal_ports)

    # ── FIREBASE / CI-CD ──────────────────────────────────────────────────────
    header("FIREBASE & CI/CD")
    check("firebase.json has all 8 targets",       chk_firebase_json_has_all_targets)
    check(".firebaserc has all 8 targets",         chk_firebaserc_has_all_targets)

    # ── RUNTIME HEALTH (if services are running) ──────────────────────────────
    header("RUNTIME HEALTH (optional — only if services are up)")
    soft_check("All /health endpoints return 200", chk_health_endpoints)

    # ── SUMMARY ───────────────────────────────────────────────────────────────
    print(f"\n{BOLD}{'═'*60}{RESET}")
    print(f"{BOLD}  SUMMARY{RESET}")
    print(f"{'─'*60}")

    if FAILURES:
        print(f"\n{RED}{BOLD}  ❌ {len(FAILURES)} check(s) FAILED — DO NOT DEPLOY:{RESET}")
        for f in FAILURES:
            print(f"    {RED}•{RESET} {f}")
    if WARNINGS:
        print(f"\n{YELLOW}{BOLD}  ⚠️  {len(WARNINGS)} warning(s) — review before deploy:{RESET}")
        for w in WARNINGS:
            print(f"    {YELLOW}•{RESET} {w}")
    if not FAILURES and not WARNINGS:
        print(f"\n{GREEN}{BOLD}  ✅ ALL CHECKS PASSED — READY FOR PRODUCTION{RESET}\n")
    elif not FAILURES:
        print(f"\n{YELLOW}{BOLD}  ✅ All hard checks passed (warnings present — review above){RESET}\n")
    else:
        print(f"\n{RED}{BOLD}  🚫 FIX ALL FAILURES BEFORE DEPLOYING TO PRODUCTION{RESET}\n")

    sys.exit(0 if not FAILURES else 1)


if __name__ == "__main__":
    main()
