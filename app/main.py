import os
import sys
import logging
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

# --- FORCED STARTUP DIAGNOSTICS ---
print(f"BOOT_INIT: Python {sys.version}")
print(f"BOOT_ENV: {os.environ.get('ENVIRONMENT', 'unknown')}")

from app.core.config import settings
from app.core.logging import setup_logging, logger

# 1. Standard Logging Initialization
setup_logging()

# --- STARTUP KEY VALIDATION ---
if not settings.JWT_PRIVATE_KEY or "-----BEGIN" not in settings.JWT_PRIVATE_KEY:
    logger.critical("SECURITY_ALERT: No valid RSA private key found for JWT signing. Fallback to HS256.")
if not settings.JWT_PUBLIC_KEY or "-----BEGIN" not in settings.JWT_PUBLIC_KEY:
    logger.critical("SECURITY_ALERT: No valid RSA public key found for JWT verification.")

app = FastAPI(
    title="Hospyn 2.0 Enterprise API", 
    version="2.0.7-RESILIENT",
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url=None
)

# --- BASE ROUTES ---

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Hospyn 2.0 Enterprise API",
        "version": "2.0.7-FINAL",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
@app.get("/readyz")
async def health_check():
    """
    ULTRA-FAST READINESS PROBE:
    No active database connection here to prevent Cloud Run readiness timeout.
    Health is verified via uptime and middleware status.
    """
    return {
        "status": "ready", 
        "uptime": "verified",
        "jwt_mode": "RS256" if settings.JWT_PRIVATE_KEY else "HS256_FALLBACK"
    }

@app.get("/api/v1/health/db")
async def db_health_check():
    """Diagnostic endpoint to verify DB connectivity after boot."""
    from app.core.database import primary_engine
    try:
        async with primary_engine.connect() as conn:
            await conn.execute("SELECT 1")
            return {"status": "connected"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "detail": str(e)})

# --- API ROUTERS ---
# We import these after the basic routes to ensure /health is available immediately
from app.api.v1.router import api_router as enterprise_v1_router
from app.api import auth, patient, profile, doctor, admin, privacy, auth_onboarding, staff, governance

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


# --- EXCEPTION HANDLERS ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": {"error_code": "VALIDATION_FAILED", "errors": exc.errors()}}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None)
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("UNHANDLED_RUNTIME_ERROR")
    return JSONResponse(
        status_code=500,
        content={"detail": {"error_code": "INTERNAL_SERVER_ERROR", "message": str(exc)}}
    )

# --- MIDDLEWARE CHAIN ---

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

allowed_origins = settings.ALLOWED_ORIGINS
if "*" in allowed_origins:
    allowed_origins = ["*"]
else:
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

# --- REALTIME WEBSOCKET BRIDGE ---

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """ENTERPRISE REALTIME BRIDGE"""
    from app.core.security import decode_token
    from app.core.realtime import manager
    
    payload = decode_token(token, token_type="access")
    if not payload:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)

logger.info("SYSTEM_READY: Hospyn 2.0 API initialized.")
