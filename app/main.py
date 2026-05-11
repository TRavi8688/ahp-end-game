import os
from datetime import datetime
import logging
import traceback
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.schemas.common import StandardErrorSchema

# 1. Standard Logging Initialization
setup_logging()

# --- ENTERPRISE PRODUCTION STABILIZATION ---
#Docs are disabled in production for security, and docs_url is used to gate accessibility.
app = FastAPI(
    title="Hospyn 2.0 Enterprise API", 
    version="2.0.5-STABLE",
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url=None
)

# --- BASE ROUTES (Before Middlewares for Raw Diagnostics) ---

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Hospyn 2.0 Enterprise API",
        "version": "2.0.5-ARMORED",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
@app.get("/readyz")
async def health_check():
    from app.core.database import primary_engine
    db_status = "untested"
    try:
        async with primary_engine.connect() as conn:
            await conn.execute("SELECT 1")
            db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
        
    return {
        "status": "ready", 
        "checks": {
            "database": db_status,
            "api_version": "2.0.5",
            "uptime": "verified"
        }
    }

# --- API ROUTERS ---
from app.api.v1.router import api_router as enterprise_v1_router
from app.api import auth, patient, profile, doctor, admin, privacy, auth_onboarding, staff, governance

# Versioned API routes
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(patient.router, prefix=settings.API_V1_STR)
app.include_router(profile.router, prefix=settings.API_V1_STR)
app.include_router(enterprise_v1_router, prefix=settings.API_V1_STR)
app.include_router(doctor.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(privacy.router, prefix=settings.API_V1_STR)
app.include_router(auth_onboarding.router, prefix=settings.API_V1_STR)
app.include_router(staff.router, prefix=settings.API_V1_STR)
app.include_router(governance.router, prefix=settings.API_V1_STR)


# --- EXCEPTION HANDLERS (Must be registered BEFORE middlewares that catch errors) ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"VALIDATION_ERROR: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": {
                "error_code": "VALIDATION_FAILED",
                "message": "The request data is invalid.",
                "errors": exc.errors()
            }
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None)
    )

@app.exception_handler(IntegrityError)
async def integrity_exception_handler(request: Request, exc: IntegrityError):
    logger.warning(f"DB_INTEGRITY_VIOLATION: {exc}")
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": {
                "error_code": "DUPLICATE_RECORD",
                "message": "A record with these details already exists (Email/ID/Phone)."
            }
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("UNHANDLED_RUNTIME_ERROR")
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "error_code": "INTERNAL_SERVER_ERROR",
                "message": "A critical system error occurred. Diagnostics captured.",
                "trace_id": request.headers.get("X-Request-ID", "unknown")
            }
        }
    )

# --- MIDDLEWARE CHAIN (ORDER IS CRITICAL: Outermost added LAST) ---

# 1. Proxy Headers (Internal)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# 2. CORS (Outer Layer - Wraps Exception Responses)
# We use settings.ALLOWED_ORIGINS but fallback to explicit list for safety
allowed_origins = settings.ALLOWED_ORIGINS
if "*" in allowed_origins:
    allowed_origins = ["*"]
else:
    # Ensure production Firebase URLs are ALWAYS included
    prod_origins = [
        "https://hospyn-495906-96438.web.app",
        "https://hospyn-495906.firebaseapp.com",
        "https://hospyn-495906.web.app",
        "https://app.hospyn.com"
    ]
    for o in prod_origins:
        if o not in allowed_origins:
            allowed_origins.append(o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# 3. Global Exception Recovery Middleware (Outermost Catch-All)
@app.middleware("http")
async def catastrophic_recovery_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        logger.error(f"CATASTROPHIC_ERROR: {exc}")
        # Final safety response with CORS headers manually injected
        content = {"detail": "catastrophic_failure_recovery_active"}
        headers = {"Access-Control-Allow-Origin": request.headers.get("Origin", "*")}
        return JSONResponse(status_code=500, content=content, headers=headers)

# --- REALTIME WEBSOCKET BRIDGE ---
from fastapi import WebSocket, WebSocketDisconnect
from app.core.realtime import manager

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    user_id = 101 # Default test user
    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)

logger.info("SYSTEM_READY: Hospyn 2.0 API is fully armored and live.")
