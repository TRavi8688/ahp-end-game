"""
tracing.py — OpenTelemetry distributed tracing setup.
Phase 12 Fix: "OpenTelemetry-ready hooks" in README becomes actual OTEL export.
Exports traces to Google Cloud Trace (production) or Jaeger (dev).

Place at: backend/app/core/tracing.py
Call configure_tracing() in main.py lifespan startup.
"""
import os
from typing import Optional

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor

from backend.app.core.logging_config import get_logger

logger = get_logger(__name__)


def configure_tracing(
    service_name: str = "hospyn-backend",
    service_version: str = "1.0.0",
    environment: str = "production",
) -> Optional[TracerProvider]:
    """
    Configure OpenTelemetry tracing.

    In production (GCP): exports to Google Cloud Trace via OTLP exporter.
    In development: logs spans to console.

    Call once at startup before the FastAPI app starts accepting requests.

    Returns the TracerProvider (can be used to add additional exporters).
    """
    env = os.environ.get("ENV", environment).lower()

    resource = Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: service_version,
        "deployment.environment": env,
        "cloud.provider": "gcp",
        "cloud.region": "asia-south1",
    })

    provider = TracerProvider(resource=resource)

    if env == "production":
        # ── Google Cloud Trace via OTLP ────────────────────────────────────
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

            otlp_endpoint = os.environ.get(
                "OTEL_EXPORTER_OTLP_ENDPOINT",
                "https://telemetry.googleapis.com:443",
            )
            exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info("otel_tracing_configured", exporter="gcp_cloud_trace")
        except ImportError:
            logger.warning(
                "otel_gcp_exporter_not_installed",
                hint="pip install opentelemetry-exporter-otlp-proto-grpc",
            )
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    elif env in ("staging", "development", "test"):
        # ── Console exporter (dev/test) ────────────────────────────────────
        if env != "test":  # Don't spam in pytest runs
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
            logger.info("otel_tracing_configured", exporter="console")
    else:
        logger.warning("otel_tracing_disabled", env=env)
        return None

    # Register as global provider
    trace.set_tracer_provider(provider)

    return provider


def instrument_app(app, engine=None) -> None:
    """
    Auto-instrument FastAPI, SQLAlchemy, HTTPX, and Redis.
    Call AFTER configure_tracing() and AFTER creating the FastAPI app.

    Args:
        app: The FastAPI application instance
        engine: SQLAlchemy async engine (optional, for DB span tracing)
    """
    # FastAPI: traces every request/response automatically
    FastAPIInstrumentor.instrument_app(
        app,
        excluded_urls="/health,/metrics",  # Don't trace health checks
    )

    # SQLAlchemy: traces every query (with sanitized SQL — no PHI in spans)
    if engine is not None:
        SQLAlchemyInstrumentor().instrument(
            engine=engine.sync_engine,
            enable_commenter=True,
        )

    # HTTPX: traces outgoing HTTP calls (to LLM providers, Twilio, etc.)
    HTTPXClientInstrumentor().instrument()

    # Redis: traces cache operations
    RedisInstrumentor().instrument()

    logger.info("otel_instrumentation_complete",
                services=["fastapi", "sqlalchemy", "httpx", "redis"])


def get_tracer(name: str = "hospyn") -> trace.Tracer:
    """Get a tracer for manual span creation."""
    return trace.get_tracer(name)


# ─── Usage example ────────────────────────────────────────────────────────────
# In main.py:
#
# from backend.app.core.tracing import configure_tracing, instrument_app
#
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     configure_tracing(service_name="hospyn-backend")
#     instrument_app(app, engine=engine)
#     yield
#
# In a service:
#
# from backend.app.core.tracing import get_tracer
# tracer = get_tracer()
#
# with tracer.start_as_current_span("encrypt_phi") as span:
#     span.set_attribute("record.type", "prescription")
#     result = encrypt(data)
