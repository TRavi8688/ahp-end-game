from datetime import datetime, timezone
import os
import sys
import time
import uuid
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager


from fastapi import FastAPI, Request, HTTPException, status, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
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
setup_logging()

# Initialize Sentry for production monitoring
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
    
    try:
        from app.core.database import get_writer_engine
        
        # STAGE 1: Infrastructure Connectivity
        logger.info(f"HOSPYN_BOOT_STAGE_1: Verifying Infrastructure [ID: {boot_id}]")
        try:
            engine = get_writer_engine()
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
                
                # Development Auto-Migration: Ensure tables exist
                if settings.ENVIRONMENT == "development":
                    logger.info("HOSPYN_BOOT_MIGRATION: Syncing local schema...")
                    from app.models.models import Base
                    def _sync_create(connection):
                        Base.metadata.create_all(connection)
                    await conn.run_sync(_sync_create)
                    logger.info("HOSPYN_BOOT_MIGRATION: Success")

            logger.info(f"HOSPYN_BOOT_DB_SUCCESS: Connection Established [ID: {boot_id}]")
        except Exception as db_e:
            logger.warning(f"HOSPYN_BOOT_DEGRADED: Database check failed (will retry): {db_e} [ID: {boot_id}]")
            app.state.boot_error = f"Database degraded: {db_e}"

        # STAGE 2: Service Verification
        logger.info(f"HOSPYN_BOOT_STAGE_2: Services Initialized [ID: {boot_id}]")
        
        logger.info(f"HOSPYN_BOOT_COMPLETE: FastAPI ready for Port Binding [ID: {boot_id}]")
    except Exception as e:
        logger.error(f"HOSPYN_BOOT_FATAL: Initialization Error: {e} [ID: {boot_id}]")
        app.state.boot_error = str(e)
        
    yield
    logger.info(f"HOSPYN_SHUTDOWN: Process {boot_id} Terminated.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# --- MIDDLEWARE ---
# PROD_RULE: Only trust localhost/loopback or specific production ingress IPs
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["127.0.0.1", "::1"] if settings.ENVIRONMENT == "production" else ["*"])

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
    
    # Content Security Policy (Allowing documentation CDNs and local development)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net; "
        "img-src 'self' data: https: fastly.jsdelivr.net; "
        "font-src 'self' cdn.jsdelivr.net; "
        "connect-src 'self' http://localhost:8000 http://localhost:8080; "
        "frame-ancestors 'none'"
    )
    
    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Permissions policy (formerly Feature-Policy)
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # HSTS (Strict-Transport-Security) - only in production
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    return response

async def https_redirect_middleware(request: Request, call_next):
    """Redirect HTTP to HTTPS in production."""
    if settings.ENVIRONMENT == "production":
        if request.url.scheme == "http":
            from fastapi.responses import RedirectResponse
            url = request.url.replace(scheme="https")
            return RedirectResponse(url=url, status_code=301)
    return await call_next(request)

# 2. MIDDLEWARE CHAIN (Order is Critical: Security first, then routing)
# HTTPS redirect (highest priority - must be first)
app.middleware("http")(https_redirect_middleware)

# Security headers (second priority)
app.middleware("http")(security_headers_middleware)

# Idempotency Protection (Stateless Resilience)
from app.core.middleware import IdempotencyMiddleware, TenantMiddleware
app.add_middleware(IdempotencyMiddleware)
app.add_middleware(TenantMiddleware)

# --- HARDENED CORS & ERROR RESILIENCE (SHIELD V7.0) ---

@app.middleware("http")
async def cors_resilience_middleware(request: Request, call_next):
    """
    ULTIMATE SHIELD: Ensures CORS headers are present even if the app crashes.
    """
    origin = request.headers.get("Origin")
    
    if request.method == "OPTIONS":
        response = JSONResponse(content="OK")
        _add_cors_headers(response, origin)
        return response

    try:
        response = await call_next(request)
        _add_cors_headers(response, origin)
        return response
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"UNCAUGHT_SYSTEM_ERROR: {str(e)}")
        logger.error(error_trace)
        response = JSONResponse(
            status_code=500,
            content={"detail": "Critical System Fault", "error": str(e), "traceback": error_trace}
        )
        _add_cors_headers(response, origin)
        return response


def _add_cors_headers(response, origin: Optional[str]):
    if not origin:
        return
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, authorization, X-Requested-With, Accept"

    response.headers["Vary"] = "Origin"

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"VALIDATION_ERROR: {exc.errors()}")
    return JSONResponse(status_code=422, content={"detail": "Validation Failed", "errors": exc.errors()})

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# --- ROUTERS ---
from app.api import auth, patient, profile, doctor, admin, privacy, auth_onboarding, staff, governance, visit
from app.api.v1.router import api_router as enterprise_v1_router

app.include_router(auth.router, prefix=settings.API_V1_STR, tags=["Authentication"])
app.include_router(patient.router, prefix=settings.API_V1_STR, tags=["Patient"])
app.include_router(profile.router, prefix=settings.API_V1_STR, tags=["Profile"])
app.include_router(enterprise_v1_router, prefix=settings.API_V1_STR)
app.include_router(doctor.router, prefix=settings.API_V1_STR, tags=["Doctor"])
app.include_router(admin.router, prefix=settings.API_V1_STR, tags=["Admin"])
app.include_router(privacy.router, prefix=settings.API_V1_STR, tags=["Privacy"])
app.include_router(auth_onboarding.router, prefix=settings.API_V1_STR, tags=["Onboarding"])
app.include_router(staff.router, prefix=settings.API_V1_STR, tags=["Staff"])
app.include_router(governance.router, prefix=settings.API_V1_STR, tags=["Governance"])
app.include_router(visit.router, prefix=settings.API_V1_STR, tags=["Visit"])

# --- HEALTH & SRE PROBES ---
@app.get("/health", tags=["Infrastructure"])
async def health_check():
    boot_error = getattr(app.state, "boot_error", None)
    if boot_error:
        return JSONResponse(status_code=503, content={"status": "degraded", "error": boot_error})
    return {
        "status": "healthy",
        "version": settings.VERSION,
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
    from app.core.security import decode_token
    from app.core.realtime import manager
    
    await websocket.accept()
    try:
        payload = decode_token(token)
        if not payload:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        user_id = payload.get("sub")
        await manager.connect(websocket, user_id)
        
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        await websocket.close()

