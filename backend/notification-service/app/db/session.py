"""
notification-service/app/db/session.py

PLACE AT: backend/notification-service/app/db/session.py
FIX: health check imports from app.db.session — re-exports from app.core.database.
"""
from app.core.database import get_db, AsyncSessionLocal, get_engine, get_session_factory, Base

__all__ = ["get_db", "AsyncSessionLocal", "get_engine", "get_session_factory", "Base"]
