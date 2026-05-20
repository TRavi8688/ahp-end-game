import os
import sys

# Set ENVIRONMENT to testing before any application modules are imported
os.environ["ENVIRONMENT"] = "testing"

import pytest
import app.core.database as database

@pytest.fixture(autouse=True)
async def cleanup_db_engines():
    """
    Ensure that the SQLAlchemy connection pool is clean and does not leak
    connections across different asyncio event loops, preventing
    'RuntimeError: Event loop is closed' failures during test execution.
    """
    yield
    # Safely dispose writer engine if initialized
    if getattr(database, "_writer_engine", None) is not None:
        try:
            await database._writer_engine.dispose()
        except Exception:
            pass
        database._writer_engine = None
        
    # Safely dispose reader engine if initialized
    if getattr(database, "_reader_engine", None) is not None:
        try:
            await database._reader_engine.dispose()
        except Exception:
            pass
        database._reader_engine = None
