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
    ENTERPRISE LOGGING (SHIELD V5):
    - Standard Console for Development.
    - Native Loguru JSON Serialization for Production (GCP).
    - Intercepts standard library logs (Uvicorn/SQLAlchemy).
    """
    # 1. Intercept Standard Logging
    logging.root.handlers = [InterceptHandler()]
    for name in ["uvicorn", "uvicorn.access", "sqlalchemy"]:
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True

    # 2. Configure Loguru
    is_prod = os.getenv("ENVIRONMENT") == "production"
    
    # Clear existing handlers
    logger.remove()
    
    # Add Console / JSON Sink
    logger.add(
        sys.stdout,
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}",
        level="INFO",
        serialize=is_prod,  # Native JSON serialization for Cloud Run
        backtrace=True,
        diagnose=not is_prod
    )

    logger.info(f"HOSPYN_LOGGING_STABILIZED | Mode: {'PRODUCTION (JSON)' if is_prod else 'DEVELOPMENT'}")

# Export logger
logger = logger
