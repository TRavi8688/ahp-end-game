"""
Auth Service Database Engine & Session Factory.

Each service owns its database connection independently.
Auth Service connects to hospyn_auth_db.
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
from sqlalchemy.orm import Session, with_loader_criteria

from shared.database.core import Base
from app.config.settings import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lazy engine & session factory (SQLite-safe for testing)
# ---------------------------------------------------------------------------


def _build_engine_args(database_url: str) -> dict:
    """Return engine kwargs appropriate for the given database URL."""
    args: dict = {"echo": (settings.ENVIRONMENT == "development")}
    # SQLite (used in testing) does not support connection-pool arguments.
    if not database_url.startswith("sqlite"):
        args.update(
            {
                "pool_size": 10,
                "max_overflow": 20,
                "pool_pre_ping": True,
                "pool_recycle": 3600,
            }
        )
    return args


_engine = None
_AsyncSessionLocal: async_sessionmaker | None = None


def get_engine():
    """Return the shared async engine, creating it on first call."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            **_build_engine_args(settings.DATABASE_URL),
        )
        logger.debug("Auth async database engine created: %s", settings.DATABASE_URL)
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


# Backwards-compatible module-level alias
class _LazySessionFactory:
    """Proxy that creates the real session factory on first attribute access."""

    def __call__(self, *args, **kwargs):
        return get_session_factory()(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(get_session_factory(), name)


AsyncSessionLocal = _LazySessionFactory()


# ---------------------------------------------------------------------------
# Global soft-delete filter (SQLAlchemy 2.0+ compatible) -- FIXED
# ---------------------------------------------------------------------------
# BUG WAS: lambda cls: getattr(cls, "deleted_at", None) is None
#   -> getattr returns the Column object (truthy), so `is None` -> Python False
#   -> SQLAlchemy emits AND 0=1 -> all queries return zero rows
#
# FIX: Use hasattr() guard then .is_(None) for a proper SQL IS NULL expression.
# Event registered on Session (sync base class), NOT on async_sessionmaker.


@event.listens_for(Session, "do_orm_execute")
def _add_filtering_criteria(execute_state):
    """
    Global soft-delete enforcement.
    Automatically filters out records where deleted_at IS NOT NULL
    for any model that exposes a deleted_at column.
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


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency -- provides a transactional database session.
    Commits automatically on success; rolls back on any exception.
    """
    async with get_session_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
