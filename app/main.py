from datetime import datetime, timezone
import os
import sys
import time
import uuid
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager


import asyncio
from fastapi import FastAPI, Request, HTTPException, status, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi import Request, Response

from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Import core infrastructure
print(">>> HOSPYN_IMPORT_BEGIN")
from app.core.config import settings
from app.core.logging import setup_logging, logger
import app.api.deps as deps

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

# Initialize structured logging instantly
print(">>> HOSPYN_LOGGING_INIT")
setup_logging()
print(">>> HOSPYN_LOGGING_SUCCESS")

# Initialize Sentry for production monitoring
print(f">>> HOSPYN_ENV_CHECK: {settings.ENVIRONMENT}")
if settings.SENTRY_DSN and settings.ENVIRONMENT == "production":
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration()],
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.2, # Record 20% of requests for performance profiling
        profiles_sample_rate=0.1,
    )
    print(">>> HOSPYN_SENTRY_ACTIVE")

print(">>> HOSPYN_IMPORT_COMPLETE")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    SENIOR IR ENGINEER - RESILIENT STARTUP LIFESPAN:
    1. Binds the port instantly.
    2. Logs every stage of initialization.
    3. Graceful degradation: Survives DB/Secret failures.
    """
    boot_id = str(uuid.uuid4())[:8]
    logger.info(f"HOSPYN_BOOT_START [ID: {boot_id}] | ENV: {settings.ENVIRONMENT}")
    
    # NON-BLOCKING BOOT: Bind port first, connect later
    async def background_init():
        try:
            from app.core.database import get_writer_engine
            logger.info(f"HOSPYN_BOOT_STAGE_1: Background Infrastructure Sync [ID: {boot_id}]")
            engine = get_writer_engine()
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info(f"HOSPYN_BOOT_DB_SUCCESS: Connection Established [ID: {boot_id}]")
        except Exception as db_e:
            logger.warning(f"HOSPYN_BOOT_DEGRADED: Database check failed: {db_e} [ID: {boot_id}]")
            app.state.boot_error = str(db_e)

    # Start init in background, allow lifespan to finish instantly
    asyncio.create_task(background_init())
    logger.info(f"HOSPYN_BOOT_COMPLETE: Web Server Active [ID: {boot_id}]")
    yield
    logger.info(f"HOSPYN_SHUTDOWN: Process {boot_id} Terminated.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

from app.core.limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- MIDDLEWARE ---
# PROD_RULE: Only trust localhost/loopback or specific production ingress IPs
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.TRUSTED_PROXIES)

# ════════════════════════════════════════════════════════════════
# SECURITY MIDDLEWARE FUNCTIONS (before adding to app)
# ════════════════════════════════════════════════════════════════

async def security_headers_middleware(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    
    # Enable XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Content Security Policy (Cloud-first: allows GCP Cloud Run and Firebase Hosting origins)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net; "
        "img-src 'self' data: https: fastly.jsdelivr.net; "
        "font-src 'self' cdn.jsdelivr.net; "
        "connect-src 'self' https://hospyn-495906-api-625745217419.us-central1.run.app https://hospyn-495906-api-7ixs2fhkna-uc.a.run.app https://*.web.app https://*.firebaseapp.com; "
        "frame-ancestors 'none'"
    )
    
    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Permissions policy (formerly Feature-Policy)
    response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(), camera=(self)"
    
    # HSTS (Strict-Transport-Security) - only in production
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    return response

async def https_redirect_middleware(request: Request, call_next):
    """Redirect HTTP to HTTPS in production."""
    if settings.ENVIRONMENT == "production":
        # Cloud Run sets X-Forwarded-Proto to https, so we respect it to avoid infinite redirect loops.
        forwarded_proto = request.headers.get("x-forwarded-proto")
        if forwarded_proto == "https":
            return await call_next(request)

        # Skip redirect for local tests and local development loopback hostnames
        if request.url.hostname in ("testserver", "localhost", "127.0.0.1", "10.0.2.2"):
            return await call_next(request)
        if request.url.scheme == "http":
            from fastapi.responses import RedirectResponse
            url = request.url.replace(scheme="https")
            return RedirectResponse(url=url, status_code=301)
    return await call_next(request)

async def request_size_limit_middleware(request: Request, call_next):
    """Global request size limiter (Default: 10MB to protect against DoS attacks)."""
    MAX_SIZE = 10 * 1024 * 1024 # 10MB limit
    if request.headers.get("content-length"):
        content_length = int(request.headers.get("content-length"))
        if content_length > MAX_SIZE:
            return JSONResponse(
                status_code=413,
                content={"success": False, "error": {"code": "PAYLOAD_TOO_LARGE", "message": "Request body exceeds 10MB limit."}}
            )
    return await call_next(request)

# 2. MIDDLEWARE CHAIN (Order is Critical: Security first, then routing)
# Size Limiter (highest priority)
app.middleware("http")(request_size_limit_middleware)

# HTTPS redirect (second priority)
app.middleware("http")(https_redirect_middleware)

# Security headers (second priority)
app.middleware("http")(security_headers_middleware)

# Idempotency Protection (Stateless Resilience)
from app.core.middleware import IdempotencyMiddleware, TenantMiddleware
from app.middleware.forensic_telemetry import ForensicTelemetryMiddleware

app.add_middleware(IdempotencyMiddleware)
app.add_middleware(TenantMiddleware)
app.add_middleware(ForensicTelemetryMiddleware)

# --- HARDENED CORS & ERROR RESILIENCE (SHIELD V7.0) ---

if settings.ENVIRONMENT == "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# --- UNIFIED ERROR RESILIENCE & INTERCEPTION ---
from app.middleware.error_handler import (
    global_exception_handler,
    db_exception_handler,
    http_exception_handler,
    validation_exception_handler
)
from sqlalchemy.exc import SQLAlchemyError

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(SQLAlchemyError, db_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)


# --- SAFE ROUTER INCLUSION (RESILIENCE MODE) ---
def safe_include(router, name, prefix=settings.API_V1_STR, tags=None):
    try:
        app.include_router(router, prefix=prefix, tags=tags)
        logger.info(f"ROUTER_LOAD_SUCCESS: {name}")
    except Exception as e:
        logger.error(f"ROUTER_LOAD_FAILURE: {name} | Error: {e}")

# Import everything inside a safe block
try:
    from app.api import auth, patient, profile, doctor, admin, privacy, auth_onboarding, staff, governance, visit, billing, pharmacy, clinical, lab, ward, surgery, settings as hospital_settings
    from app.api.v1.endpoints import onboarding, owner_analytics
    from app.api.v1.router import api_router as enterprise_v1_router

    safe_include(owner_analytics.router, "Owner Analytics", prefix=f"{settings.API_V1_STR}/owner", tags=["Owner Analytics"])
    safe_include(auth.router, "Authentication", tags=["Authentication"])
    safe_include(patient.router, "Patient", tags=["Patient"])
    safe_include(profile.router, "Profile", tags=["Profile"])
    safe_include(enterprise_v1_router, "Enterprise V1")
    safe_include(doctor.router, "Doctor", tags=["Doctor"])
    safe_include(admin.router, "Admin", tags=["Admin"])
    safe_include(privacy.router, "Privacy", tags=["Privacy"])
    safe_include(auth_onboarding.router, "Onboarding", tags=["Onboarding"])
    safe_include(staff.router, "Staff", tags=["Staff"])
    safe_include(governance.router, "Governance", tags=["Governance"])
    safe_include(visit.router, "Visit", tags=["Visit"])
    safe_include(billing.router, "Billing", tags=["Billing"])
    safe_include(pharmacy.router, "Pharmacy", tags=["Pharmacy"])
    safe_include(clinical.router, "Clinical", tags=["Clinical"])
    safe_include(lab.router, "Laboratory", tags=["Laboratory"])
    safe_include(ward.router, "Ward Management", prefix=settings.API_V1_STR + "/ward", tags=["Ward Management"])
    safe_include(surgery.router, "Surgery Management", prefix=settings.API_V1_STR + "/surgery", tags=["Surgery Management"])
    safe_include(onboarding.router, "Premium Onboarding", prefix=settings.API_V1_STR + "/onboarding", tags=["Premium Onboarding"])
    safe_include(hospital_settings.router, "Hospital Settings", prefix=settings.API_V1_STR + "/hospital-settings", tags=["Hospital Settings"])
except Exception as global_e:
    logger.critical(f"GLOBAL_IMPORT_FAILURE: The system is running in DEGRADED MODE. Error: {global_e}")

@app.get("/", tags=["Infrastructure"])
async def root():
    return {"message": "Welcome to Hospyn 2.0 Enterprise API"}

# --- HEALTH & SRE PROBES ---
@app.get("/health", tags=["Infrastructure"])
async def health_check(db: AsyncSession = Depends(deps.get_db)):
    """
    ENHANCED DEPLOYMENT HEALTHCHECK (Priority 3):
    Verifies:
    1. Base application readiness (e.g. boot errors)
    2. Database connectivity
    3. Optional Redis availability (if configured)
    """
    boot_error = getattr(app.state, "boot_error", None)
    if boot_error:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "reason": "startup_failed",
                "error": boot_error
            }
        )
    
    # 1. Verify database connectivity
    db_healthy = False
    db_error = None
    try:
        await db.execute(text("SELECT 1"))
        db_healthy = True
    except Exception as e:
        db_error = str(e)
        logger.error(f"HEALTH_CHECK_DB_FAILURE: {db_error}")

    # 2. Verify Redis status (Optional)
    from app.core.cache import cache
    redis_healthy = False
    if settings.USE_REDIS and settings.REDIS_URL:
        redis_healthy = await cache.is_healthy()
    else:
        redis_healthy = None  # Not configured / disabled

    # Status determination: database connectivity is critical
    if not db_healthy:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "offline",
                "database_error": db_error,
                "redis": "online" if redis_healthy else "offline" if redis_healthy is False else "disabled"
            }
        )

    return {
        "status": "healthy",
        "version": settings.VERSION,
        "database": "online",
        "redis": "online" if redis_healthy else "offline" if redis_healthy is False else "disabled",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/healthz", tags=["Infrastructure"])
async def liveness_probe():
    """Liveness probe: Minimal check if the process is alive."""
    return {"status": "alive", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/readyz", tags=["Infrastructure"])
async def readiness_check(db: AsyncSession = Depends(deps.get_db)):
    """Readiness probe: Checks if subsystems are ready."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

# --- WEBSOCKET ---
@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    await handle_websocket_connection(websocket, token)

@app.websocket("/api/v1/ws/{token}")
async def websocket_endpoint_v1(websocket: WebSocket, token: str):
    await handle_websocket_connection(websocket, token)

async def handle_websocket_connection(websocket: WebSocket, token: str):
    from app.core.security import decode_token
    from app.core.realtime import manager
    
    await websocket.accept()
    try:
        payload = decode_token(token)
        if not payload:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        user_id = payload.get("sub")
        await manager.connect(user_id, websocket)
        
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        await websocket.close()

