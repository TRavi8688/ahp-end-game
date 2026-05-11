import logging
import sys
import os

def setup_logging():
    """Ultra-resilient logging for Cloud Run startup."""
    root_logger = logging.getLogger()
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)
    
    # Minimize noise from third-party libs
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# Export a standard logger for immediate use
logger = logging.getLogger("hospyn_api")
