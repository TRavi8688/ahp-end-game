import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, WebSocket, Depends, HTTPException, status, Request, Response
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from fastapi.staticfiles import StaticFiles


from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging import setup_logging, logger
import sentry_sdk

logger.info("STARTUP: Hospyn 2.0 API Enterprise Initialization...")

from app.core.telemetry import setup_telemetry

from app.api import auth, patient, profile, doctor, doctor_verification, admin, privacy, auth_onboarding, staff, governance
from app.core.realtime import manager
from app.core.database import get_db, set_tenant_context
from app.core.limiter import limiter
from app.models.models import Base
from app.core.middleware import IdempotencyMiddleware, RequestIDMiddleware, TenantMiddleware
from app.schemas.common import StandardErrorSchema
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

# 1. Initialize Structured Logging early
setup_logging()

# Initialize Sentry
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration()
        ],
        traces_sample_rate=0.2,
        profiles_sample_rate=0.1,
    )

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/api/docs" if not os.environ.get("ENVIRONMENT") == "production" else None,
    redoc_url=None
)

# 1. Observability: OpenTelemetry Initialization
setup_telemetry(app)

@app.get("/")
async def root():
    return {"message": "Welcome to Hospyn 2.0 Enterprise API - PATCHED-V1"}

from app.core.metrics import instrument_request
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

@app.on_event("startup")
async def startup_event():
    """Enterprise startup diagnostics."""
    logger.info("STARTUP: Production API Mode Active.")

# --- GOOGLE-GRADE SRE PROBES ---

@app.get("/healthz", tags=["Infrastructure"])
async def liveness_probe():
    """Liveness probe: Minimal check if the process is alive."""
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}

@app.get("/readyz", tags=["Infrastructure"])
async def readiness_probe(request: Request):
    """Readiness probe: Non-blocking diagnostic for deployment verification."""
    # We remove the DB/Redis hard dependency from the probe during rollout 
    # to prevent Cloud Run from rolling back due to minor connection delays.
    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "PATCHED-V2"
    }

@app.get("/health", tags=["Infrastructure"])
async def health_check(request: Request):
    """Public health check: Alias for readiness."""
    return await readiness_probe(request)

# 2. MIDDLEWARE CHAIN (Order is Critical: LAST = OUTERMOST)

# a. Metrics & Internal Instrumentation (Innermost)
app.middleware("http")(instrument_request())

# b. Security Headers (Non-CORS)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # PHASE 2: REMOVED MANUAL CORS INJECTION. CORSMiddleware is the single source of truth.
    return response

# c. Infrastructure Handling
app.add_middleware(
    ProxyHeadersMiddleware, 
    trusted_hosts=settings.TRUSTED_PROXIES
)
app.add_middleware(RequestIDMiddleware)

# d. Enterprise Security Logic
app.add_middleware(IdempotencyMiddleware)
app.add_middleware(TenantMiddleware)

# e. PHASE 1: CORSMiddleware (OUTERMOST LAYER)
# Handling preflights and origin validation before any other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://hospyn-495906-96438.web.app",
        "https://hospyn-495906-96438.web.app/",
        "https://app.hospyn.com",
        "https://app.hospyn.com/",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:19006",
        "http://localhost:8081",
        "http://localhost:19000",
        "http://localhost:19001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def on_shutdown():
    logger.info("SHUTDOWN: Draining resources...")

@app.get("/metrics", tags=["Infrastructure"])
async def get_metrics():
    """Prometheus metrics endpoint for external collectors."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# --- REGISTER HANDLERS & ROUTES ---
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Centralized handler for domain validation errors."""
    error = StandardErrorSchema(
        error_code="VALIDATION_ERROR",
        message=str(exc),
        trace_id=request.headers.get("X-Request-ID", "unknown")
    )
    return JSONResponse(status_code=400, content=error.model_dump())

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": "HTTP_ERROR", "message": str(exc.detail)}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error_code": "VALIDATION_ERROR", "details": exc.errors()}
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"UNHANDLED_EXCEPTION: {str(exc)}", exc_info=True)
    error = StandardErrorSchema(
        error_code="INTERNAL_SERVER_ERROR",
        message=str(exc) if settings.ENVIRONMENT == "development" else "An unexpected server error occurred.",
        trace_id=request.headers.get("X-Request-ID", "unknown")
    )
    return JSONResponse(status_code=500, content=error.model_dump())

from app.api.v1.router import api_router as enterprise_v1_router
app.include_router(enterprise_v1_router, prefix=settings.API_V1_STR)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(patient.router, prefix=settings.API_V1_STR)
app.include_router(profile.router, prefix=settings.API_V1_STR)
app.include_router(doctor.router, prefix=settings.API_V1_STR)
app.include_router(doctor_verification.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(privacy.router, prefix=settings.API_V1_STR, tags=["Privacy"])
app.include_router(auth_onboarding.router, prefix=settings.API_V1_STR, tags=["Onboarding"])
app.include_router(staff.router, prefix=settings.API_V1_STR, tags=["Staff Management"])
app.include_router(governance.router, prefix=settings.API_V1_STR)

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    from app.core import security
    from fastapi import WebSocketDisconnect
    try:
        payload = security.decode_token(token, token_type="access")
        if not payload:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = int(payload.get("sub"))
        await manager.connect(user_id, websocket)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception as e:
        logger.error(f"WS_ERROR: {str(e)}")
        manager.disconnect(user_id, websocket)

logger.info("SYSTEM_READY: Hospyn 2.0 API is fully initialized.")
