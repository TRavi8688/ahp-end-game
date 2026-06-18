"""
Hospyn Healthcare Core — FastAPI Application Entry Point
FIXES:
  BUG-1: partner_orders_router was used but never imported → NameError at startup.
  BUG-2: Redux Provider missing from main.tsx (handled in web fix).
"""
import logging
import os
import time
import uuid

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.config.settings import settings
from shared.logger import setup_logging as configure_logging

configure_logging()
logger = logging.getLogger(__name__)

# ─── Sentry ──────────────────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        environment=settings.ENV,
        release=os.getenv("GITHUB_SHA", "local"),
    )
    logger.info("Sentry initialised", extra={"service": "healthcare-core"})


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Hospyn Healthcare Core API",
    description="Healthcare management platform API",
    version="2.0.0",
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url=None,
)


# ─── X-Correlation-ID middleware ─────────────────────────────────────────────
import structlog

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    correlation_id = (
        request.headers.get("X-Correlation-ID")
        or request.headers.get("X-Request-ID")
        or str(uuid.uuid4())
    )
    structlog.contextvars.bind_contextvars(trace_id=correlation_id)

    start = time.monotonic()

    try:
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000)
        response.headers["X-Correlation-ID"] = correlation_id
        logger.info(
            "request",
            extra={
                "service": "healthcare-core",
                "trace_id": correlation_id,
                "path": request.url.path,
                "method": request.method,
                "duration_ms": duration_ms,
                "status": response.status_code,
            },
        )
        return response
    finally:
        structlog.contextvars.clear_contextvars()


# ─── CORS ────────────────────────────────────────────────────────────────────
def configure_cors(application: FastAPI) -> None:
    raw_origins = settings.ALLOWED_ORIGINS.strip()

    if not raw_origins:
        raise RuntimeError("ALLOWED_ORIGINS is not set.")

    if "*" in raw_origins and settings.ENV == "production":
        raise RuntimeError("ALLOWED_ORIGINS='*' is not allowed in production.")

    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    logger.info("CORS allowed origins: %s", origins)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )


configure_cors(app)


# ─── Health check ────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Deep Health check for Cloud Run. Checks DB and Redis.
    Returns 503 if infrastructure is unreachable.
    """
    from app.core.database import get_db
    from sqlalchemy import text
    from shared.redis_client import get_redis

    db_status = "connected"
    try:
        async for db in get_db():
            await db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("DB health check failed", extra={"error": str(exc)})
        db_status = "unavailable"

    redis_status = "connected"
    try:
        redis = get_redis()
        if redis:
            await redis.ping()
        else:
            redis_status = "unavailable"
    except Exception as exc:
        logger.error("Redis health check failed", extra={"error": str(exc)})
        redis_status = "unavailable"

    payload = {
        "status": "ok" if db_status == "connected" and redis_status == "connected" else "degraded",
        "service": "healthcare-core",
        "version": "2.0.0",
        "db": db_status,
        "redis": redis_status,
    }
    return JSONResponse(
        content=payload,
        status_code=200 if db_status == "connected" else 503,
    )


# ─── Partner App Routers ─────────────────────────────────────────────────────
# BUG-1 FIX: partner_orders_router was referenced but never imported.
# This caused an immediate NameError crashing the entire service at startup.
from app.api.v1.partner_auth import router as partner_auth_router
from app.api.v1.partner_dashboard import router as partner_dashboard_router
from app.api.v1.partner_inventory import router as partner_inventory_router
from app.api.v1.partner_orders import router as partner_orders_router      # ← WAS MISSING
from app.api.v1.partner_referrals import router as partner_referrals_router

app.include_router(partner_auth_router,      prefix="/api/v1/partner", tags=["Partner Auth"])
app.include_router(partner_dashboard_router, prefix="/api/v1/partner", tags=["Partner Dashboard"])
app.include_router(partner_inventory_router, prefix="/api/v1/partner", tags=["Partner Inventory"])
app.include_router(partner_orders_router,    prefix="/api/v1/partner", tags=["Partner Orders"])
app.include_router(partner_referrals_router, prefix="/api/v1/partner", tags=["Partner Referrals"])

# ─── Internal Service-to-Service Routes ──────────────────────────────────────
from app.api.internal import router as internal_router
app.include_router(internal_router, prefix="/api/v1/healthcare")

# ─── Core API Routes ─────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1/healthcare")
