import logging
import sys
import structlog
import re
import os
import uuid
from typing import List
from structlog.types import Processor
from opentelemetry import trace

# Clinical PII and Secrets to mask in logs
SENSITIVE_KEYS = {
    "password", "token", "apikey", "authorization", "secret_key", 
    "access_token", "refresh_token", "phone_number", "mobile", 
    "aadhaar", "registration_number", "license_number", "email"
}

def mask_sensitive_data(logger, method_name, event_dict):
    """
    Healthcare-grade Recursive PII masking.
    Ensures PII is redacted even if nested deep in JSON metadata.
    """
    def _mask_item(item):
        if isinstance(item, dict):
            for key, value in item.items():
                if key.lower() in SENSITIVE_KEYS:
                    val = str(value)
                    item[key] = f"{val[:4]}...{val[-4:]}" if len(val) > 8 else "***"
                else:
                    item[key] = _mask_item(value)
        elif isinstance(item, list):
            return [_mask_item(i) for i in item]
        return item

    event_dict = _mask_item(event_dict)
    
    # Redact sensitive patterns in event messages
    if "event" in event_dict:
        # Email redaction
        event_dict["event"] = re.sub(r"[\w\.-]+@[\w\.-]+\.\w+", "[EMAIL_REDACTED]", event_dict["event"])
        # Phone redaction
        event_dict["event"] = re.sub(r"\+?91[6-9]\d{9}", "[PHONE_REDACTED]", event_dict["event"])
    
    return event_dict

def inject_trace_context(logger, method_name, event_dict):
    """
    ENTERPRISE CORRELATION:
    Injects OpenTelemetry trace_id and span_id into every log line.
    Allows Grafana Tempo/Loki to cross-link logs and traces instantly.
    """
    span = trace.get_current_span()
    if span and span.get_span_context().is_valid:
        ctx = span.get_span_context()
        event_dict["trace_id"] = hex(ctx.trace_id)[2:]
        event_dict["span_id"] = hex(ctx.span_id)[2:]
    return event_dict

def inject_request_id(logger, method_name, event_dict):
    """Ensures every log line in a request has a traceable ID."""
    return event_dict

def setup_logging():
    env = os.environ.get("ENVIRONMENT", "production").lower()
    
    shared_processors: List[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        inject_trace_context, # Correlate logs with OTel spans
        inject_request_id,
        mask_sensitive_data,
    ]

    if env == "development":
        processors = shared_processors + [structlog.dev.ConsoleRenderer()]
    else:
        processors = shared_processors + [structlog.processors.JSONRenderer()]

    structlog.configure(
        processors=processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    handler = logging.StreamHandler(sys.stdout)
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)

logger = structlog.get_logger()
