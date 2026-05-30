"""
Hospyn Auth Service — Main Application.

Handles: User registration, login, JWT issuance, OTP flows, password reset.
This service is the ONLY service that issues tokens.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import sentry_sdk

from app.api.router import router as auth_router
from app.config.settings import settings
from shared.exceptions.handlers import register_exception_handlers
from shared.logger import setup_logging
from shared.middleware.correlation import CorrelationIdMiddleware

logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info(
        f"🔐 Auth Service starting",
        environment=settings.ENVIRONMENT,
        jwt_alg=settings.JWT_ALGORITHM,
    )

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

    # Initialize Redis connection
    from shared.redis_client import init_redis, close_redis

    try:
        await init_redis(settings.REDIS_URL)
        logger.info("   ✅ Redis connected")
    except Exception as e:
        logger.warning(
            f"   ⚠️ Redis connection failed: {e} — token blacklisting disabled"
        )

    yield

    # Cleanup
    try:
        from shared.redis_client import close_redis

        await close_redis()
    except Exception:
        pass
    logger.info("🔐 Auth Service shutting down gracefully.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    description="Hospyn Authentication Service — Registration, Login, JWT, OTP, Password Reset",
    lifespan=lifespan,
)

# Add Request Correlation ID Middleware (must be added before CORS so it wraps outer layer)
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

# Rate limiting — strict limits on auth-sensitive endpoints
from shared.middleware.rate_limiter import RateLimitMiddleware

app.add_middleware(
    RateLimitMiddleware,
    default_limit=60,
    default_window=60,
    route_limits={
        "/api/v1/auth/login": (5, 60),  # 5 login attempts per minute
        "/api/v1/auth/register": (10, 60),  # 10 registrations per minute
        "/api/v1/auth/forgot-password/request": (3, 60),  # 3 OTP requests per minute
        "/api/v1/auth/forgot-password/verify": (
            5,
            60,
        ),  # 5 OTP verify attempts per minute
    },
)

# Register shared exception handlers
register_exception_handlers(app)

# Include Auth Routes
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])


@app.get("/health", tags=["Infrastructure"])
async def health_check():
    """Health check endpoint for Docker, Nginx, and load balancers."""
    return {"status": "healthy", "service": "auth-service"}
