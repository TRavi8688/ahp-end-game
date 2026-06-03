"""
metrics.py — Prometheus metrics and health check endpoint.
Phase 12 Fix: wires prometheus-client (already in pyproject.toml) into actual metrics.

Place at: backend/app/api/metrics.py
Register router in main.py: app.include_router(metrics_router)
"""
import time
import os
from typing import Dict, Any

from fastapi import APIRouter, Response
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
    REGISTRY,
)

from backend.app.core.logging_config import get_logger

logger = get_logger(__name__)
metrics_router = APIRouter()

# ─── Metric definitions ───────────────────────────────────────────────────────

# HTTP request metrics
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# Business metrics
otp_sent_total = Counter("otp_sent_total", "Total OTPs sent", ["channel"])
otp_failed_total = Counter("otp_failed_total", "Total OTP verification failures")
login_success_total = Counter("login_success_total", "Total successful logins", ["role"])
login_failure_total = Counter("login_failure_total", "Total failed login attempts")

appointment_created_total = Counter(
    "appointment_created_total", "Total appointments created", ["hospital_id"]
)
prescription_created_total = Counter(
    "prescription_created_total", "Total prescriptions created"
)

# Infrastructure metrics
db_pool_size = Gauge("db_pool_size", "Current database connection pool size")
db_pool_checked_out = Gauge("db_pool_checked_out", "DB connections currently in use")
redis_connected = Gauge("redis_connected", "Redis connection status (1=up, 0=down)")
active_sessions = Gauge("active_sessions", "Currently active user sessions")


# ─── Middleware helper ────────────────────────────────────────────────────────

class MetricsMiddleware:
    """
    Starlette middleware that records request count and duration.
    Add to main.py: app.add_middleware(MetricsMiddleware)  — BEFORE other middleware
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "unknown")
        method = scope.get("method", "unknown")

        # Skip metrics endpoint itself to avoid cardinality explosion
        if path in ("/metrics", "/health", "/favicon.ico"):
            await self.app(scope, receive, send)
            return

        # Normalize path to avoid high cardinality (e.g. /patients/123 → /patients/{id})
        normalized_path = _normalize_path(path)

        start_time = time.perf_counter()
        status_code = 500

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = time.perf_counter() - start_time
            http_requests_total.labels(
                method=method,
                endpoint=normalized_path,
                status_code=str(status_code),
            ).inc()
            http_request_duration_seconds.labels(
                method=method,
                endpoint=normalized_path,
            ).observe(duration)


def _normalize_path(path: str) -> str:
    """Replace numeric path segments with {id} to avoid high cardinality."""
    import re
    path = re.sub(r"/\d+", "/{id}", path)
    path = re.sub(r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "/{uuid}", path)
    return path


# ─── Health check endpoint ────────────────────────────────────────────────────

@metrics_router.get("/health", tags=["observability"])
async def health_check() -> Dict[str, Any]:
    """
    Comprehensive health check.
    Returns 200 if all critical dependencies are healthy.
    Returns 503 if any critical dependency is down.
    Phase 12 Fix: replaces missing health check with full dependency status.
    """
    checks: Dict[str, Any] = {}
    overall_healthy = True

    # ── Database check ─────────────────────────────────────────────────────
    try:
        from backend.app.core.database import engine
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        checks["database"] = {"status": "healthy"}
    except Exception as e:
        checks["database"] = {"status": "unhealthy", "error": str(e)}
        overall_healthy = False
        logger.error("health_check_db_failed", error=str(e))

    # ── Redis check ────────────────────────────────────────────────────────
    try:
        from backend.app.core.cache import get_redis_client
        redis = await get_redis_client()
        await redis.ping()
        checks["redis"] = {"status": "healthy"}
        redis_connected.set(1)
    except Exception as e:
        checks["redis"] = {"status": "unhealthy", "error": str(e)}
        overall_healthy = False
        redis_connected.set(0)
        logger.error("health_check_redis_failed", error=str(e))

    # ── Encryption key check ───────────────────────────────────────────────
    enc_key = os.environ.get("ENCRYPTION_KEY")
    if enc_key and len(enc_key) >= 44:
        checks["encryption_key"] = {"status": "present"}
    else:
        checks["encryption_key"] = {"status": "missing_or_invalid"}
        overall_healthy = False
        logger.critical("health_check_enc_key_missing")

    status = "healthy" if overall_healthy else "degraded"
    http_status = 200 if overall_healthy else 503

    return Response(
        content=__import__("json").dumps({
            "status": status,
            "checks": checks,
            "service": "hospyn-backend",
            "environment": os.environ.get("ENV", "unknown"),
        }),
        status_code=http_status,
        media_type="application/json",
    )


@metrics_router.get("/metrics", tags=["observability"])
async def prometheus_metrics():
    """
    Expose Prometheus metrics for scraping.
    Phase 12 Fix: prometheus-client was in pyproject.toml but never exposed.
    Restrict access to internal network only (configure in nginx.conf).
    """
    return Response(
        content=generate_latest(REGISTRY),
        media_type=CONTENT_TYPE_LATEST,
    )
