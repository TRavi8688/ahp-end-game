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

# Initialize Logging First
setup_logging()

# Initialize Sentry for Enterprise Observability
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.2 if settings.ENVIRONMENT == "production" else 1.0,
        profiles_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
        environment=settings.ENVIRONMENT,
    )
    logger.info(f"STARTUP: Sentry Observability Enabled ({settings.ENVIRONMENT}).")

logger.info("STARTUP: AHP 2.0 API Enterprise Initialization...")

# --- OpenTelemetry REMOVED for RAM optimization ---
# meter = metrics.get_meter("ahp.api")
# http_request_counter = ...

from app.api import auth, patient, profile, doctor, doctor_verification
from app.core.realtime import manager
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.models import Base
from app.core.middleware import IdempotencyMiddleware, RequestIDMiddleware
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

from app.core.metrics import instrument_request
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

# 2. MIDDLEWARE CHAIN (Order is Critical)
# Traceability & Metrics first
app.add_middleware(RequestIDMiddleware)
app.middleware("http")(instrument_request())
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID", "X-Idempotency-Key"],
)

# Idempotency (Must be after RequestID for logging correlation)
app.add_middleware(IdempotencyMiddleware)

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
async def readiness_probe(request: Request, db: AsyncSession = Depends(get_db)):
    """Readiness probe: Checks if subsystems are ready. Secure diagnostics."""
    status_code = 200
    subsystems = {"db": "up"}
    
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"READINESS_FAILURE: {e}")
        status_code = 503
        subsystems["db"] = "down"

    response = {
        "status": "ready" if status_code == 200 else "not_ready",
        "timestamp": datetime.utcnow().isoformat()
    }

    # Secure exposure: Only show subsystems if admin token matches
    if request.headers.get("X-Admin-Token") == settings.SECRET_KEY:
        response["subsystems"] = subsystems

    return JSONResponse(status_code=status_code, content=response)

@app.get("/health", tags=["Infrastructure"])
async def health_check(request: Request, db: AsyncSession = Depends(get_db)):
    """Public health check: Alias for readiness but minimal exposure."""
    return await readiness_probe(request, db)

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
    """Centralized handler for domain validation errors (ValueErrors from services)."""
    error = StandardErrorSchema(
        error_code="VALIDATION_ERROR",
        message=str(exc),
        trace_id=request.headers.get("X-Request-ID", "unknown")
    )
    return JSONResponse(status_code=400, content=error.dict())

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Fallback centralized error handler for unhandled exceptions."""
    logger.error(f"UNHANDLED_EXCEPTION: {str(exc)}", exc_info=True)
    
    # Capture exception in Sentry with contextual tagging
    with sentry_sdk.configure_scope() as scope:
        # Assuming user might be attached to request.state by auth middleware
        if hasattr(request.state, "user"):
            scope.set_user({"id": request.state.user.id})
            if hasattr(request.state.user, "hospital_id"):
                scope.set_tag("hospital_id", request.state.user.hospital_id)
        
        # Tag traces
        trace_id = request.headers.get("X-Request-ID", "unknown")
        scope.set_tag("trace_id", trace_id)
        sentry_sdk.capture_exception(exc)

    error = StandardErrorSchema(
        error_code="INTERNAL_SERVER_ERROR",
        message="An unexpected server error occurred.",
        trace_id=request.headers.get("X-Request-ID", "unknown")
    )
    return JSONResponse(status_code=500, content=error.dict())

from app.api.v1.router import api_router as enterprise_v1_router
app.include_router(enterprise_v1_router, prefix=settings.API_V1_STR)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(patient.router, prefix=settings.API_V1_STR)
app.include_router(profile.router, prefix=settings.API_V1_STR)
app.include_router(doctor.router, prefix=settings.API_V1_STR)
app.include_router(doctor_verification.router, prefix=settings.API_V1_STR)

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """Secure WebSocket Bridge for Real-time Notifications & Chat."""
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

# --- STABILITY BRIDGES ---
# SPAs are now hosted on Vercel/CDN for better scalability
# Removed StaticFiles mounting and /patient route

logger.info("SYSTEM_READY: AHP 2.0 API is fully initialized.")

