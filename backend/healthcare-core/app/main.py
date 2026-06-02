"""
Hospyn Healthcare Core — Main Application.

This is the core healthcare backend. It handles:
- Hospital management
- Doctor profiles
- Patient records (PHI)
- Appointment scheduling & lifecycle

Authentication is NEVER handled here. All requests must carry
a valid JWT issued by the Auth Service.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sentry_sdk

from app.api.router import router as healthcare_router
from app.config.settings import settings
from shared.exceptions.handlers import register_exception_handlers
from shared.logger import setup_logging
from shared.middleware.correlation import CorrelationIdMiddleware
from app.core.startup_check import run_startup_checks

run_startup_checks()

logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("🏥 Healthcare Core starting", environment=settings.ENVIRONMENT)

    if hasattr(settings, "SENTRY_DSN") and settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=1.0,
        )
        logger.info("   ✅ Sentry initialized")

    # Run production safety checks
    from shared.startup_checks import validate_production_secrets

    try:
        validate_production_secrets(settings)
    except ValueError as e:
        logger.critical(f"FATAL STARTUP ERROR: {e}")
        raise e

    # Initialize Redis for token blacklist checks
    from shared.redis_client import init_redis, close_redis

    try:
        await init_redis(settings.REDIS_URL)
        logger.info("   ✅ Redis connected")
    except Exception as e:
        logger.warning(
            f"   ⚠️ Redis connection failed: {e} — blacklist checks disabled"
        )

    yield

    # Cleanup
    try:
        await close_redis()
    except Exception:
        pass
    logger.info("🏥 Healthcare Core shutting down gracefully.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    description="Healthcare Core API — Hospitals, Doctors, Patients, Appointments",
    lifespan=lifespan,
)

# Add Request Correlation ID Middleware
app.add_middleware(CorrelationIdMiddleware)

# CORS — strict in production, env-driven origins
_allowed_origins = (
    ["*"]
    if settings.ENVIRONMENT == "development"
    else settings.ALLOWED_ORIGINS.split(",")
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,  # Cache preflight for 10 minutes
)

# Rate limiting
from shared.middleware.rate_limiter import RateLimitMiddleware

app.add_middleware(
    RateLimitMiddleware,
    default_limit=100,
    default_window=60,
)

# Register shared exception handlers (consistent error format across all services)
register_exception_handlers(app)

# Mount all healthcare routes under /api/v1/healthcare
app.include_router(healthcare_router, prefix="/api/v1/healthcare", tags=["Healthcare"])


@app.get("/health", tags=["Infrastructure"])
async def health_check():
    """Health check endpoint for Docker, Nginx, and load balancers."""
    return {"status": "healthy", "service": "healthcare-core"}
