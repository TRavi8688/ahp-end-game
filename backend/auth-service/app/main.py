# SEC-5 FIX: Safe CORS configuration
# Apply to BOTH:
#   backend/auth-service/app/main.py
#   backend/healthcare-core/app/main.py
#
# Replace the current conditional wildcard CORS block with this pattern.

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

app = FastAPI()


def configure_cors(app: FastAPI) -> None:
    """
    SEC-5 FIX: CORS is configured from an explicit allowlist env var.

    NEVER use a wildcard. If ALLOWED_ORIGINS is empty at startup, raise
    an error immediately so misconfigurations are caught before traffic reaches
    the service — not silently discovered after a breach.
    """
    raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()

    if not raw_origins:
        # Fail fast at startup — do not silently open to all origins.
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
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )


configure_cors(app)
