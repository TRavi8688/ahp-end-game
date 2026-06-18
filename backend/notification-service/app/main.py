"""
Hospyn Notification Service — FastAPI Application Entry Point
Phase L-3: Added Sentry, X-Request-ID middleware, structured JSON logging, DB health check.
"""
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.notifications import router as notifications_router
from app.api.router import api_router
from app.config.settings import settings
from app.core.logging_config import configure_logging

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
    logger.info("Sentry initialised", extra={"service": "notification-service"})


# ─── CORS ────────────────────────────────────────────────────────────────────
def configure_cors(application: FastAPI) -> None:
    raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()

    if not raw_origins:
        if settings.ENV == "development":
            origins = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:8000"]
            logger.warning("DEVELOPMENT MODE: Using default CORS origins: %s", origins)
        else:
            raise RuntimeError(
                "ALLOWED_ORIGINS env var is not set. "
                "Set it to comma-separated allowed origins. "
                "Never use '*' in production."
            )
    else:
        origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

    if "*" in origins and settings.ENV == "production":
        raise RuntimeError("ALLOWED_ORIGINS='*' is not allowed in production.")

    logger.info("CORS allowed origins: %s", origins)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )


# ─── Lifespan ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(application: FastAPI):
    logger.info("Starting Hospyn Notification Service...")
    try:
        settings.validate_required()
        logger.info("Settings validated")
    except RuntimeError as exc:
        logger.critical("Configuration error: %s", exc)
        raise

    if settings.SMS_TEST_MODE:
        logger.warning("SMS_TEST_MODE is enabled — messages will be logged, not sent")
    if not settings.twilio_configured:
        logger.warning("Twilio credentials not fully configured")
    else:
        logger.info("Twilio configured")

    yield

    logger.info("Notification Service shutting down")


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Hospyn Notification Service",
    description="Handles SMS, push, and in-app notifications for the Hospyn platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url=None,
)

configure_cors(app)


# ─── X-Request-ID middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request",
        extra={
            "service": "notification-service",
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "duration_ms": duration_ms,
            "status": response.status_code,
        },
    )
    return response


# ─── Health check ────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health():
    """
    Health check for Cloud Run. Checks DB with SELECT 1.
    Returns 503 if DB is unreachable so Cloud Run removes the instance.
    """
    from app.db.session import get_db
    from sqlalchemy import text

    db_status = "connected"
    try:
        async for db in get_db():
            await db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("DB health check failed", extra={"error": str(exc)})
        db_status = "unavailable"

    payload = {
        "status": "ok" if db_status == "connected" else "degraded",
        "service": "notification-service",
        "version": "1.0.0",
        "db": db_status,
    }
    return JSONResponse(content=payload, status_code=200 if db_status == "connected" else 503)


# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(api_router)
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications"])
