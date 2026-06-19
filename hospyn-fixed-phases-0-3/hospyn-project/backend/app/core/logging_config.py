"""
logging_config.py — Structured logging with correlation IDs and PII masking.
Phase 12 Fix: replaces ad-hoc print/logging with structlog + JSON output.

Place at: backend/app/core/logging_config.py
"""
import logging
import re
import sys
from contextvars import ContextVar
from typing import Any, MutableMapping

import structlog

# ─── Context variable for request correlation ID ──────────────────────────────
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")

# ─── PII masking patterns ─────────────────────────────────────────────────────
# These patterns mask Indian phone numbers, emails, Aadhaar, PAN, and common PHI

_PII_PATTERNS = [
    # Indian mobile numbers (+91 or 0 prefix)
    (re.compile(r"(\+91|0)?\s*[6-9]\d{9}"), "[PHONE_REDACTED]"),
    # Email addresses
    (re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"), "[EMAIL_REDACTED]"),
    # Aadhaar (12 digits, possibly spaced)
    (re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"), "[AADHAAR_REDACTED]"),
    # PAN card (5 letters, 4 digits, 1 letter)
    (re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"), "[PAN_REDACTED]"),
    # Common PHI field values
    (re.compile(r'"(phone|email|aadhaar|pan|address|dob|date_of_birth)"\s*:\s*"[^"]*"', re.IGNORECASE),
     lambda m: m.group(0).split(":")[0] + ': "[REDACTED]"'),
]


def _mask_pii(value: str) -> str:
    """Apply all PII masking patterns to a string."""
    for pattern, replacement in _PII_PATTERNS:
        if callable(replacement):
            value = pattern.sub(replacement, value)
        else:
            value = pattern.sub(replacement, value)
    return value


class PIIMaskingProcessor:
    """structlog processor that masks PII in all log values."""

    def __call__(
        self, logger: Any, method: str, event_dict: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]:
        for key, value in list(event_dict.items()):
            if isinstance(value, str):
                event_dict[key] = _mask_pii(value)
        return event_dict


class CorrelationIDProcessor:
    """structlog processor that injects the current request's correlation ID."""

    def __call__(
        self, logger: Any, method: str, event_dict: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]:
        cid = correlation_id_var.get("")
        if cid:
            event_dict["correlation_id"] = cid
        return event_dict


def configure_logging(json_logs: bool = True, log_level: str = "INFO") -> None:
    """
    Call once at application startup (in main.py lifespan).

    Args:
        json_logs: True in production (JSON for Cloud Logging), False in dev (pretty)
        log_level: Log level string ("DEBUG", "INFO", "WARNING", "ERROR")
    """
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        CorrelationIDProcessor(),
        PIIMaskingProcessor(),
        structlog.processors.StackInfoRenderer(),
    ]

    if json_logs:
        # Production: JSON output for Cloud Logging / Grafana Loki
        renderer = structlog.processors.JSONRenderer()
    else:
        # Development: human-readable colored output
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(log_level.upper())
        ),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.getLevelName(log_level.upper()))

    # Suppress noisy libraries
    logging.getLogger("uvicorn.access").propagate = False
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str = __name__) -> structlog.stdlib.BoundLogger:
    """Get a structlog logger. Use in place of logging.getLogger()."""
    return structlog.get_logger(name)
