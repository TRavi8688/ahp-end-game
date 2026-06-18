"""
healthcare-core/app/db/session.py

PLACE AT: backend/healthcare-core/app/db/session.py
FIX: app/main.py health check imports `from app.db.session import get_db`
     but the real session lives at app/core/database.py.
     This shim re-exports it so both paths work without moving code.
"""
from app.core.database import get_db, AsyncSessionLocal, get_engine, get_session_factory, Base

__all__ = ["get_db", "AsyncSessionLocal", "get_engine", "get_session_factory", "Base"]
