"""
healthcare-core/app/core/logging_config.py

PLACE AT: backend/healthcare-core/app/core/logging_config.py
FIX: File was missing — caused ModuleNotFoundError crash on startup.
Identical content to auth-service/app/core/logging_config.py.
"""
import json
import logging
import os


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "severity": record.levelname,
            "time": self.formatTime(record, self.datefmt),
            "logger": record.name,
            "message": record.getMessage(),
        }
        skip = {
            "args", "created", "exc_info", "exc_text", "filename",
            "funcName", "levelname", "levelno", "lineno", "message",
            "module", "msecs", "msg", "name", "pathname", "process",
            "processName", "relativeCreated", "stack_info", "taskName",
            "thread", "threadName",
        }
        for key, value in record.__dict__.items():
            if key not in skip:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    root = logging.getLogger()
    if any(
        isinstance(h, logging.StreamHandler)
        and isinstance(getattr(h, "formatter", None), _JsonFormatter)
        for h in root.handlers
    ):
        return
    level = getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
