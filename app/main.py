import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from fastapi import FastAPI, WebSocket, Depends, status, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.logging import setup_logging, logger
import sentry_sdk

# 1. Initialize Structured Logging early
setup_logging()

# Initialize Sentry
if settings.SENTRY_DSN:
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.2,
    )

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
)

@app.get("/")
async def root():
    return {"message": "Welcome to Hospyn 2.0 Enterprise API - STABLE-V1"}

@app.get("/health")
@app.get("/readyz")
async def health_check():
    return {"status": "ready", "version": "STABLE-V1", "timestamp": datetime.utcnow().isoformat()}

# --- MIDDLEWARE STACK (ORDER IS CRITICAL) ---

# 1. Proxy Headers (Internal)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# 2. Custom Security Logic (BaseHTTPMiddleware based)
from app.core.middleware import IdempotencyMiddleware, RequestIDMiddleware, TenantMiddleware
app.add_middleware(TenantMiddleware)
app.add_middleware(IdempotencyMiddleware)
app.add_middleware(RequestIDMiddleware)

# 3. CORS (OUTERMOST - Added Last in Starlette)
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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTES ---
from app.api.v1.router import api_router as enterprise_v1_router
from app.api import auth, patient, profile, doctor, doctor_verification, admin, privacy, auth_onboarding, staff, governance

app.include_router(enterprise_v1_router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(patient.router, prefix=settings.API_V1_STR)
app.include_router(profile.router, prefix=settings.API_V1_STR)
app.include_router(doctor.router, prefix=settings.API_V1_STR)
app.include_router(doctor_verification.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(privacy.router, prefix=settings.API_V1_STR)
app.include_router(auth_onboarding.router, prefix=settings.API_V1_STR)
app.include_router(staff.router, prefix=settings.API_V1_STR)
app.include_router(governance.router, prefix=settings.API_V1_STR)

# --- EXCEPTION HANDLERS ---
from app.schemas.common import StandardErrorSchema

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"UNHANDLED_EXCEPTION: {str(exc)}", exc_info=True)
    error = StandardErrorSchema(
        error_code="INTERNAL_SERVER_ERROR",
        message="An unexpected server error occurred.",
        trace_id=request.headers.get("X-Request-ID", "unknown")
    )
    return JSONResponse(status_code=500, content=error.model_dump())

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error_code": "HTTP_ERROR", "message": exc.detail})

logger.info("SYSTEM_READY: Hospyn 2.0 API is fully initialized.")
