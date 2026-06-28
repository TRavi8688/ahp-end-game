"""
security_hardening.py
Phase 4 Fix: Security hardening additions

This file contains code SNIPPETS to apply to existing files.
Each section is labelled with the exact file to edit.

==========================================================================
SECTION A -- Redis health check at startup
FILE: backend/auth-service/app/main.py
ADD in the startup_event function:
==========================================================================
"""

# -- A. Redis startup health check -----------------------------------------
# Paste inside the @app.on_event("startup") async def startup_event():

REDIS_STARTUP_CHECK = '''
    # Phase 4: Redis health check -- refuse to start if Redis is down
    # (OTP brute-force protection depends entirely on Redis)
    try:
        import sys
        from app.core.redis_client import redis_client   # adjust import if needed
        await redis_client.ping()
        logger.info("Redis health check passed ✓")
    except Exception as redis_err:
        logger.critical(
            f"STARTUP FAILURE: Redis is unreachable -- {redis_err}. "
            "OTP brute-force protection cannot function. Refusing to start."
        )
        sys.exit(1)
'''

# -------------------------------------------------------------------------


"""
==========================================================================
SECTION B -- /health endpoint with Redis status
FILE: backend/auth-service/app/main.py  (add after startup_event)
==========================================================================
"""

HEALTH_ENDPOINT = '''
@app.get("/health")
async def health_check():
    """
    Health check endpoint for load balancer and monitoring.
    Returns Redis status as part of the response.
    """
    from datetime import datetime, timezone
    health = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "auth-service",
        "checks": {}
    }

    # Redis check
    try:
        from app.core.redis_client import redis_client
        await redis_client.ping()
        health["checks"]["redis"] = "ok"
    except Exception as e:
        health["checks"]["redis"] = f"FAIL: {str(e)}"
        health["status"] = "degraded"

    # DB check
    try:
        from app.core.database import async_session_maker
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        health["checks"]["database"] = "ok"
    except Exception as e:
        health["checks"]["database"] = f"FAIL: {str(e)}"
        health["status"] = "degraded"

    status_code = 200 if health["status"] == "ok" else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(content=health, status_code=status_code)
'''


"""
==========================================================================
SECTION C -- Triage engine feature flag
FILE: backend/ai-service/app/main.py
ADD to settings and at the top of the triage endpoint:
==========================================================================
"""

TRIAGE_FEATURE_FLAG = '''
# In settings.py -- add:
ENABLE_TRIAGE_ENGINE: bool = False  # Requires clinical sign-off before enabling

# In ai-service/app/main.py -- add to triage endpoint:
from fastapi import HTTPException

@router.post("/triage")
async def triage_patient(payload: dict):
    if not settings.ENABLE_TRIAGE_ENGINE:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "TRIAGE_ENGINE_DISABLED",
                "message": (
                    "The AI triage engine is pending clinical validation. "
                    "A registered medical professional must review and approve "
                    "all threshold values before this feature can be enabled. "
                    "Contact your system administrator."
                ),
                "enable_with": "ENABLE_TRIAGE_ENGINE=true in ai-service .env (after clinical approval)"
            }
        )
    # ... rest of triage logic
'''


"""
==========================================================================
SECTION D -- DPDP data_rights router registration check
FILE: backend/healthcare-core/app/main.py  OR  backend/app/main.py
ADD if not already present:
==========================================================================
"""

DPDP_REGISTRATION = '''
# Check if data_rights is registered. If not, add:
from backend.app.api.data_rights import router as data_rights_router

app.include_router(
    data_rights_router,
    prefix="/api/v1/data-rights",
    tags=["DPDP Compliance"]
)

# Test with:
#   GET  /api/v1/data-rights/export/{patient_id}
#   DELETE /api/v1/data-rights/delete/{patient_id}
'''


"""
==========================================================================
SECTION E -- CORS: set production allowed origins
FILE: backend/auth-service/app/main.py  AND  backend/healthcare-core/app/main.py
REPLACE the existing CORSMiddleware add call:
==========================================================================
"""

CORS_CONFIG = '''
import os
from fastapi.middleware.cors import CORSMiddleware

# Pull from env -- comma-separated list
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173"  # dev fallback only
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Hospital-ID"],
)

# In .env / GitHub Secrets set:
# ALLOWED_ORIGINS=https://hospyn.com,https://doctor.hospyn.com,https://admin.hospyn.com,https://reception.hospyn.com
'''


"""
==========================================================================
SECTION F -- Sentry initialization
FILE: Each service's main.py  (auth-service, healthcare-core, ai-service)
ADD before app = FastAPI(...):
==========================================================================
"""

SENTRY_INIT = '''
import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

_sentry_dsn = os.environ.get("SENTRY_DSN", "")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.1,          # 10% of requests traced
        profiles_sample_rate=0.1,
        environment=os.environ.get("ENVIRONMENT", "production"),
        send_default_pii=False,          # Never send PII to Sentry
    )

# requirements.txt -- add:
# sentry-sdk[fastapi]
'''


"""
==========================================================================
SECTION G -- OTP console-log security fix
FILE: backend/auth-service/app/services/auth_service.py
FIND and REPLACE the line that logs OTP plaintext:
==========================================================================
"""

OTP_LOG_FIX = '''
# FIND (line contains logger.warning with otp_code in f-string):
#   logger.warning(f"SMTP not configured. Mocking email to {email_address} with OTP {otp_code}")

# REPLACE WITH:
#   logger.warning(
#       f"SMTP not configured. OTP email skipped for {email_address[:4]}****"
#       # NEVER log otp_code -- it is a security secret
#   )
'''


"""
==========================================================================
SECTION H -- mock_token_123 removal
FILE: hospyn-v2-web/src/pages/OwnerDashboard.jsx
Delete the block roughly lines 56-101 that reads:
==========================================================================
"""

MOCK_TOKEN_REMOVAL = '''
// DELETE this entire block from OwnerDashboard.jsx:
// if(token === 'mock_token_123') {
//   setDashboardData({ ... Apollo Hospitals fake data ... })
//   setLoading(false)
//   return
// }

// REPLACE the whole data-fetching section with:
useEffect(() => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) {
    setError("Not authenticated. Please log in.");
    setLoading(false);
    return;
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  fetch(`${apiBase}/api/v1/owner/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => {
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      return r.json();
    })
    .then((data) => {
      setDashboardData(data);
      setLoading(false);
    })
    .catch((err) => {
      setError(`Failed to load dashboard: ${err.message}`);
      setLoading(false);
    });
}, []);
'''
