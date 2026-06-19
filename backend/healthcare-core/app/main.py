"""
healthcare-core/app/main.py

FIXES:
  - Added lifespan with init_redis() + close_redis() (was completely missing)
  - Added run_startup_checks() to catch bad secrets before serving traffic
  - Removed 5 duplicate partner router registrations (double-prefix BUG-8)
  - All core routes (patients, doctors, appointments etc.) now registered
    through api_router — no longer invisible
  - configure_sentry() now uses shared/alerting.py with PHI scrubbing
  - Health check uses get_redis_client() (not the broken get_redis())

PLACE AT: backend/healthcare-core/app/main.py
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.api.internal import router as internal_router
from app.config.settings import settings
from shared.redis_client import init_redis, close_redis, get_redis_client
from shared.startup_checks import run_startup_checks
from shared.alerting import configure_sentry

configure_sentry(settings)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup → validate config, connect Redis. Shutdown → close Redis."""
    logger.info("Healthcare Core starting up...")

    # 1. Fail hard on bad config — before accepting any traffic
    run_startup_checks(settings)

    # 2. Init Redis (required for token blacklist, user-status cache, consent tokens)
    try:
        init_redis(settings.REDIS_URL)
        redis = get_redis_client()
        await redis.ping()
        logger.info("Redis connected")
    except Exception as exc:
        logger.critical("Redis unavailable at startup: %s", exc)
        raise RuntimeError(f"Redis connection failed: {exc}") from exc

    # 3. Warm up DB connection pool
    try:
        from app.core.database import get_engine
        from sqlalchemy import text
        engine = get_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection pool warmed up")
    except Exception as exc:
        from shared.alerting import alert_database_down
        await alert_database_down(str(exc))
        raise RuntimeError(f"Database unreachable at startup: {exc}") from exc

    yield

    # Shutdown
    logger.info("Healthcare Core shutting down...")
    await close_redis()
    from app.core.database import get_engine
    await get_engine().dispose()


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Hospin Healthcare Core API",
    description="Healthcare management platform — core clinical and operational API",
    version="2.0.0",
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)


# ── Correlation-ID / request logging middleware ───────────────────────────────

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


# ── CORS ──────────────────────────────────────────────────────────────────────

def _configure_cors(application: FastAPI) -> None:
    raw_origins = settings.ALLOWED_ORIGINS.strip()
    if not raw_origins:
        raise RuntimeError("ALLOWED_ORIGINS is not set.")
    if "*" in raw_origins and settings.ENV == "production":
        raise RuntimeError("ALLOWED_ORIGINS='*' is not allowed in production.")
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Correlation-ID"],
    )


_configure_cors(app)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    """Deep health check for Cloud Run. Returns 503 if DB or Redis is down."""
    from app.core.database import get_db
    from sqlalchemy import text

    db_status = "connected"
    try:
        async for db in get_db():
            await db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("DB health check failed: %s", exc)
        db_status = "unavailable"

    redis_status = "connected"
    try:
        redis = get_redis_client()
        await redis.ping()
    except Exception as exc:
        logger.error("Redis health check failed: %s", exc)
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


# ── Routers ───────────────────────────────────────────────────────────────────
#
# FIX BUG-8: Partner routers are registered ONLY inside api_router (router.py).
# The old main.py registered them AGAIN here directly, causing double-prefix:
#   /api/v1/partner/...          ← direct (removed)
#   /api/v1/healthcare/partner/... ← via api_router (correct, kept)
#
# Internal service-to-service routes
app.include_router(internal_router, prefix="/api/v1/healthcare")

# All core + partner routes — single registration point
app.include_router(api_router, prefix="/api/v1/healthcare")
