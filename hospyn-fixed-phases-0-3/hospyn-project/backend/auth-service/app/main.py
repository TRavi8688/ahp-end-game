# SEC-5 FIX: Safe CORS configuration
# startup_check must run first — before FastAPI app is created

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.startup_check import run_startup_checks
run_startup_checks()

logger = logging.getLogger(__name__)

app = FastAPI(title="Hospyn Auth Service", version="1.0.0")


def configure_cors(app: FastAPI) -> None:
    """
    CORS is configured from an explicit allowlist env var.
    NEVER use a wildcard.
    """
    raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()

    if not raw_origins:
        raise RuntimeError(
            "ALLOWED_ORIGINS env var is not set or is empty. "
            "Set it to a comma-separated list of allowed origins, e.g.:\n"
            "  ALLOWED_ORIGINS=https://app.hospyn.in,https://admin.hospyn.in\n"
            "Never use '*' in production."
        )

    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    logger.info("CORS allowed origins: %s", origins)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,  # Frontends use Authorization: Bearer header
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )


configure_cors(app)

# Wire observability middleware (modules already exist in codebase)
try:
    from app.core.logging_config import setup_logging  # type: ignore
    setup_logging()
except ImportError:
    pass

try:
    from backend.app.core.alerting import setup_sentry  # type: ignore
    from app.core.config import settings
    setup_sentry(settings)
except Exception:
    pass

try:
    from backend.app.middleware.correlation_middleware import CorrelationMiddleware  # type: ignore
    app.add_middleware(CorrelationMiddleware)
except ImportError:
    pass

# Include routers
try:
    from app.api.router import router
    app.include_router(router, prefix="/api/v1")
except ImportError:
    pass


@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth-service"}
