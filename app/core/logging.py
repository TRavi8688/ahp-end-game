import sys
import os
import json
import logging
from loguru import logger

class InterceptHandler(logging.Handler):
    def emit(self, record):
        # Get corresponding Loguru level if it exists
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())

def setup_logging():
    """
    ENTERPRISE LOGGING:
    - Structured JSON for Cloud Run / GCP Logs Explorer.
    - Intercepts standard logging (uvicorn, sqlalchemy).
    - Colorized console for local dev.
    """
    # 1. Remove all default handlers
    logging.root.handlers = [InterceptHandler()]
    logging.getLogger("uvicorn").handlers = []
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("sqlalchemy").handlers = []

    # 2. Configure Loguru
    config = {
        "handlers": [
            {
                "sink": sys.stdout,
                "format": "{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}",
                "level": "INFO",
                "colorize": True
            }
        ],
    }

    # 3. Add JSON handler for Production (Cloud Run)
    if os.getenv("ENVIRONMENT") == "production":
        config["handlers"].append({
            "sink": sys.stdout,
            "format": lambda record: json.dumps({
                "time": record["time"].isoformat(),
                "level": record["level"].name,
                "message": record["message"],
                "module": record["name"],
                "function": record["function"],
                "line": record["line"],
                "extra": record["extra"]
            }),
            "level": "INFO"
        })

    logger.configure(**config)

setup_logging()
# Export logger
logger = logger
