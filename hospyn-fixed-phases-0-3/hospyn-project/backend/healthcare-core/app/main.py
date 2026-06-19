# Healthcare Core main.py
# startup_check must run first — before FastAPI app is created

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.startup_check import run_startup_checks
run_startup_checks()

logger = logging.getLogger(__name__)

app = FastAPI(title="Hospyn Healthcare Core", version="1.0.0")


def configure_cors(app: FastAPI) -> None:
    raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
    if not raw_origins:
        raise RuntimeError(
            "ALLOWED_ORIGINS env var is not set or is empty. "
            "Set explicit origins, never '*'."
        )
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )


configure_cors(app)

# Wire observability and security middleware
try:
    from app.core.observability import setup_sentry, setup_metrics
    from app.core.config import settings
    setup_sentry(settings)
    setup_metrics(app)
except Exception as e:
    logger.warning("Could not setup observability: %s", e)

try:
    from app.middleware.audit import setup_audit_middleware
    setup_audit_middleware(app)
except Exception as e:
    logger.warning("Could not setup audit middleware: %s", e)

try:
    from app.middleware.correlation_middleware import CorrelationMiddleware
    app.add_middleware(CorrelationMiddleware)
except ImportError:
    pass

# Rate limiting
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    import os as _os
    limiter = Limiter(key_func=get_remote_address, storage_uri=_os.environ.get("REDIS_URL", "redis://localhost:6379"))
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
except ImportError:
    pass

# Include main API router
from app.api.router import router as main_router
app.include_router(main_router, prefix="/api/v1/healthcare")

# Include DPDP data rights endpoints
try:
    from backend.app.api.data_rights import router as data_rights_router  # type: ignore
    app.include_router(data_rights_router, prefix="/api/v1/account", tags=["account"])
except ImportError:
    pass

# Include metrics
try:
    from backend.app.api.metrics import metrics_router  # type: ignore
    app.include_router(metrics_router)
except ImportError:
    pass


@app.get("/health")
async def health():
    return {"status": "ok", "service": "healthcare-core"}
