"""
healthcare-core database module.

Engine and session factory are initialised lazily so that:
  - Tests can override `get_db` via FastAPI dependency_overrides without
    the import touching a real database server.
  - Pool settings are applied only when the driver supports them (i.e. NOT
    for the in-memory SQLite driver used during testing).
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


# ---------------------------------------------------------------------------
# ORM Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy ORM models in healthcare-core.
    All models must inherit from this class.
    """
    pass


# ---------------------------------------------------------------------------
# Lazy engine & session factory
# ---------------------------------------------------------------------------

_engine = None
_AsyncSessionLocal: async_sessionmaker | None = None


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


def get_engine():
    """Return the shared async engine, creating it on first call."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            **_build_engine_args(settings.DATABASE_URL),
        )
        logger.debug("Async database engine created: %s", settings.DATABASE_URL)
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


# Keep a module-level alias so that any existing code that does
#   `from app.core.database import AsyncSessionLocal`
# still works — it just calls through to the factory on use.
class _LazySessionFactory:
    """Proxy that creates the real session factory on first attribute access."""

    def __call__(self, *args, **kwargs):
        return get_session_factory()(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(get_session_factory(), name)


AsyncSessionLocal = _LazySessionFactory()


# ---------------------------------------------------------------------------
# Global soft-delete filter (SQLAlchemy 2.0+ compatible)
# ---------------------------------------------------------------------------

# In SQLAlchemy 2.0+ async the `do_orm_execute` event MUST be registered on
# the base `sqlalchemy.orm.Session` class (the underlying sync class used by
# AsyncSession internally).  Registering on `async_sessionmaker` or its
# `sync_session_class` attribute does NOT work and raises AttributeError.

@event.listens_for(Session, "do_orm_execute")
def _add_filtering_criteria(execute_state):
    """
    Global soft-delete enforcement.

    Automatically filters out records where `deleted_at IS NOT NULL` for any
    model that exposes a `deleted_at` column.  Applied transparently to every
    SELECT emitted via this session so callers never need to remember the
    filter themselves.
    """
    if execute_state.is_select and not execute_state.is_column_load:
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(
                Base,
                lambda cls: getattr(cls, "deleted_at").is_(None) if hasattr(cls, "deleted_at") else True,
                include_aliases=True,
            )
        )


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a transactional database session.

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
