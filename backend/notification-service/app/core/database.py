"""
notification-service/app/core/database.py

PLACE AT: backend/notification-service/app/core/database.py

FIX 1: Engine was created at MODULE IMPORT TIME — crashed if DATABASE_URL
        missing from .env before FastAPI even started. Converted to lazy init.
FIX 2: Added pool_recycle=3600 — prevents stale connection errors after
        8+ hours of inactivity on Cloud SQL / Cloud Run.
FIX 3: Added soft-delete filter matching auth-service and healthcare-core.
FIX 4: Lazy init allows test dependency_overrides to work correctly.
"""
from __future__ import annotations

import logging
from typing import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, with_loader_criteria

from app.config.settings import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


# ── Lazy engine & session factory ─────────────────────────────────────────────

_engine = None
_AsyncSessionLocal: async_sessionmaker | None = None


def _build_engine_args(database_url: str) -> dict:
    args: dict = {"echo": (settings.ENV == "development")}
    if not database_url.startswith("sqlite"):
        args.update({
            "pool_size": 10,
            "max_overflow": 20,
            "pool_pre_ping": True,
            "pool_recycle": 3600,   # FIX: recycle idle connections every hour
        })
    return args


def get_engine():
    """Return the shared async engine, creating it on first call (lazy)."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            **_build_engine_args(settings.DATABASE_URL),
        )
        logger.debug("Notification service DB engine created: %s", settings.DATABASE_URL)
    return _engine


def get_session_factory() -> async_sessionmaker:
    """Return the shared async session factory, creating it on first call."""
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _AsyncSessionLocal


class _LazySessionFactory:
    """Proxy so existing code using AsyncSessionLocal() still works."""
    def __call__(self, *args, **kwargs):
        return get_session_factory()(*args, **kwargs)
    def __getattr__(self, name):
        return getattr(get_session_factory(), name)


AsyncSessionLocal = _LazySessionFactory()


# ── Soft-delete filter ────────────────────────────────────────────────────────

@event.listens_for(Session, "do_orm_execute")
def _add_filtering_criteria(execute_state):
    """
    Global soft-delete enforcement.
    Filters deleted_at IS NOT NULL for any model with a deleted_at column.
    """
    if execute_state.is_select and not execute_state.is_column_load:
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(
                Base,
                lambda cls: (
                    getattr(cls, "deleted_at").is_(None)
                    if hasattr(cls, "deleted_at")
                    else True
                ),
                include_aliases=True,
            )
        )


# ── FastAPI dependency ────────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — transactional session, auto-commit/rollback."""
    async with get_session_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
