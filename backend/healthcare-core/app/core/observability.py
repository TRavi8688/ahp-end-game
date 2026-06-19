"""
backend/healthcare-core/app/core/observability.py
==================================================
FIXES APPLIED:
  - Sentry now actually wired up (DSN from settings)
  - Prometheus /metrics endpoint exposed
  - Request count and latency metrics tracked
  - Zero config needed after copy-paste
"""

import time
import logging
from fastapi import FastAPI, Request

logger = logging.getLogger(__name__)


def setup_sentry(settings) -> None:
    """
    Initialise Sentry error tracking.
    Call this FIRST in main.py, before creating the FastAPI app.

    FIXED: Previously SENTRY_DSN was in pyproject.toml dependencies
    but was never actually configured — so errors were silently lost.
    """
    if not settings.SENTRY_DSN:
        logger.warning(
            "SENTRY_DSN not configured — errors will not be tracked. "
            "Set SENTRY_DSN in your environment or Secret Manager."
        )
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.redis import RedisIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            integrations=[
                FastApiIntegration(transaction_style="url"),
                SqlalchemyIntegration(),
                RedisIntegration(),
                LoggingIntegration(
                    level=logging.INFO,       # Capture INFO and above as breadcrumbs
                    event_level=logging.ERROR, # Send ERROR as events
                ),
            ],
            # Capture 10% of transactions for performance monitoring
            traces_sample_rate=0.10,
            # Don't send PII (user IPs, emails) to Sentry
            send_default_pii=False,
            # Ignore common non-actionable errors
            ignore_errors=[KeyboardInterrupt],
        )
        logger.info(
            f"Sentry initialised for environment: {settings.ENVIRONMENT}"
        )
    except ImportError:
        logger.error(
            "sentry-sdk not installed. "
            "Add it to requirements.txt: sentry-sdk[fastapi]"
        )


def setup_prometheus(app: FastAPI) -> None:
    """
    Add a /metrics endpoint returning Prometheus-format metrics.
    Also adds request count and latency tracking middleware.

    Usage in main.py:
        setup_prometheus(app)

    Metrics exposed:
        hospin_http_requests_total{method, endpoint, status}
        hospin_http_request_duration_seconds{method, endpoint}
    """
    try:
        from prometheus_client import (
            Counter, Histogram, make_asgi_app,
            CONTENT_TYPE_LATEST, generate_latest
        )

        REQUEST_COUNT = Counter(
            "hospin_http_requests_total",
            "Total HTTP requests",
            ["method", "endpoint", "status"],
        )
        REQUEST_DURATION = Histogram(
            "hospin_http_request_duration_seconds",
            "HTTP request duration in seconds",
            ["method", "endpoint"],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
        )

        @app.middleware("http")
        async def prometheus_middleware(request: Request, call_next):
            start = time.perf_counter()

            # Don't track /metrics calls themselves (would be recursive noise)
            if request.url.path == "/metrics":
                return await call_next(request)

            response = await call_next(request)
            duration = time.perf_counter() - start

            # Normalise endpoint (strip UUIDs/IDs to avoid cardinality explosion)
            endpoint = _normalise_path(request.url.path)

            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=endpoint,
                status=str(response.status_code),
            ).inc()

            REQUEST_DURATION.labels(
                method=request.method,
                endpoint=endpoint,
            ).observe(duration)

            return response

        # Mount the /metrics endpoint
        metrics_app = make_asgi_app()
        app.mount("/metrics", metrics_app)
        logger.info("Prometheus /metrics endpoint registered")

    except ImportError:
        logger.warning(
            "prometheus-client not installed — /metrics endpoint disabled. "
            "Add it to requirements.txt: prometheus-client"
        )


def _normalise_path(path: str) -> str:
    """
    Replace dynamic path segments (UUIDs, integers) with placeholders.
    Prevents high-cardinality Prometheus labels.

    Example:
        /api/v1/patients/abc-123-def/records → /api/v1/patients/{id}/records
    """
    import re
    # Replace UUIDs
    path = re.sub(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        "{uuid}",
        path,
    )
    # Replace pure integers
    path = re.sub(r"/\d+", "/{id}", path)
    return path
