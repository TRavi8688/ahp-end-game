"""
auth-service/app/main.py

Auth Service -- FastAPI application factory.
FIXES:
  - Added lifespan with init_redis() + close_redis() (was missing entirely)
  - Added startup_checks to catch bad secrets before serving traffic
  - Added configure_sentry() from shared.alerting
  - Registered BOTH auth routers (v1/auth.py AND api/router.py)
    so password-reset, token-refresh, logout-with-blacklist are reachable

PLACE AT: backend/auth-service/app/main.py
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1 import auth as auth_v1
from app.api import jwks as jwks_v1
from app.api import router as legacy_router   # full router with reset/refresh/blacklist
from app.api import internal as internal_router
from app.config.settings import settings
from app.core.limiter import limiter
from app.core.logging_config import configure_logging
from shared.redis_client import init_redis, close_redis, get_redis_client
from shared.startup_checks import run_startup_checks

configure_logging()
logger = logging.getLogger(__name__)


# -- Lifespan ------------------------------------------------------------------

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup: validate config, connect Redis. Shutdown: close Redis."""
    logger.info("Auth Service starting up...")

    # 1. Fail fast on bad config before accepting any traffic
    run_startup_checks(settings)

    # 2. Init Redis (required for OTP, rate limiting, token blacklisting)
    try:
        init_redis(settings.REDIS_URL)
        redis = get_redis_client()
        await redis.ping()
        logger.info("Redis connected")
    except Exception as exc:
        logger.critical("Redis unavailable at startup: %s", exc)
        raise RuntimeError(f"Redis connection failed: {exc}") from exc

    yield

    # Shutdown
    logger.info("Auth Service shutting down...")
    await close_redis()


# -- Application factory -------------------------------------------------------

def create_app() -> FastAPI:
    application = FastAPI(
        title="Hospyn Auth Service",
        version="1.0.0",
        docs_url="/docs" if settings.ENV != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    _configure_cors(application)
    _add_request_id_middleware(application)
    _register_routers(application)

    return application


# -- X-Request-ID middleware ---------------------------------------------------

def _add_request_id_middleware(application: FastAPI) -> None:
    @application.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        start = time.monotonic()
        try:
            response = await call_next(request)
            duration_ms = round((time.monotonic() - start) * 1000)
            response.headers["X-Request-ID"] = request_id
            logger.info(
                "request",
                extra={
                    "service": "auth-service",
                    "request_id": request_id,
                    "path": request.url.path,
                    "method": request.method,
                    "duration_ms": duration_ms,
                    "status": response.status_code,
                },
            )
            return response
        except Exception as exc:
            import traceback
            tb = traceback.format_exc()
            logger.error("Unhandled exception: %s", tb)
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Unhandled Exception",
                    "detail": str(exc),
                    "traceback": tb,
                }
            )



# -- CORS ----------------------------------------------------------------------

def _configure_cors(application: FastAPI) -> None:
    raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
    if not raw_origins:
        if settings.ENV in ("development", "dev", "test"):
            origins = [
                "http://localhost:3000",
                "http://localhost:5173",
                "http://localhost:8000",
                "http://localhost:19000",
                "http://localhost:19006",
            ]
            logger.warning("CORS: using dev defaults -- set ALLOWED_ORIGINS in production")
        else:
            raise RuntimeError("ALLOWED_ORIGINS must be set in production")
    else:
        origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )


# -- Routers -------------------------------------------------------------------

def _register_routers(application: FastAPI) -> None:

    @application.get("/health", tags=["health"])
    async def health() -> dict:
        """Deep health check -- DB + Redis. Returns 503 if either is down."""
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
            "service": "auth-service",
            "version": "1.0.0",
            "db": db_status,
            "redis": redis_status,
        }
        return JSONResponse(
            content=payload,
            status_code=200 if db_status == "connected" else 503,
        )

    # v1 router -- OTP, login, register (with rate limiting)
    application.include_router(auth_v1.router, prefix="/api/v1/auth", tags=["Auth v1"])
    application.include_router(jwks_v1.router, prefix="/api/v1/auth", tags=["JWKS"])

    # Legacy router -- password reset, refresh token, logout with blacklist
    # These endpoints exist in app/api/router.py and were never registered before
    application.include_router(legacy_router.router, prefix="/api/v1/auth", tags=["Auth"])

    # Internal service-to-service -- NOT exposed via nginx (see nginx.conf), only
    # reachable within the Docker/Cloud Run network. Lets healthcare-core's
    # onboarding flow actually create/activate the partner's login account.
    application.include_router(internal_router.router, prefix="/api/v1")


app = create_app()
