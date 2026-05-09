import logging
from opentelemetry import trace, metrics
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

from app.core.config import settings

logger = logging.getLogger(__name__)

def setup_telemetry(app):
    """
    ENTERPRISE OBSERVABILITY SETUP:
    Configures distributed tracing (OTel) for the entire platform.
    Connects to an OTLP-compatible backend (Tempo, Jaeger, Honeycomb).
    """
    if settings.ENVIRONMENT == "development":
        logger.info("TELEMETRY: Skipping OTLP export in development.")
        return

    resource = Resource.create({
        "service.name": settings.PROJECT_NAME,
        "service.version": settings.VERSION,
        "deployment.environment": settings.ENVIRONMENT
    })

    # 1. Tracing Setup
    tracer_provider = TracerProvider(resource=resource)
    
    # Configure OTLP Exporter (Tempo/Jaeger)
    otlp_exporter = OTLPSpanExporter(
        endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
        insecure=True # Set to False and provide certs for prod
    )
    
    tracer_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    trace.set_tracer_provider(tracer_provider)

    # 2. Automatic Instrumentation
    FastAPIInstrumentor.instrument_app(
        app, 
        tracer_provider=tracer_provider,
        excluded_urls="/health,/metrics"
    )
    
    # Instrument SQLAlchemy (Database)
    from app.core.database import primary_engine
    if primary_engine:
        SQLAlchemyInstrumentor().instrument(
            engine=primary_engine.sync_engine, # Instrument the underlying sync engine
            service_name=settings.PROJECT_NAME
        )

    # Instrument Redis
    RedisInstrumentor().instrument(tracer_provider=tracer_provider)
    
    # Instrument HTTPX (External AI calls, MSG91, etc.)
    HTTPXClientInstrumentor().instrument(tracer_provider=tracer_provider)

    logger.info(f"TELEMETRY: OpenTelemetry tracing initialized for {settings.PROJECT_NAME}")

def get_tracer():
    return trace.get_tracer(__name__)
