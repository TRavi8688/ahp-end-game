"""
healthcare-core/app/core/database.py

FIXES:
  - pool_size: 10 → 20, max_overflow: 20 → 40 (Cloud Run 10k req/s)
  - statement_timeout=30s to prevent hung queries blocking pool
  - pool_recycle and pool_pre_ping already present — kept
  - Added pool size env-var overrides for easy tuning without code changes
  - Removed SQLite fallback in production (enforced by startup_checks)

PLACE AT: backend/healthcare-core/app/core/database.py
"""
from __future__ import annotations

import logging
from typing import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, with_loader_criteria
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.config.settings import settings

logger = logging.getLogger(__name__)


# ── ORM Base ──────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models in healthcare-core."""
    pass


# ── Engine factory ────────────────────────────────────────────────────────────

_engine: AsyncEngine | None = None
_AsyncSessionLocal: async_sessionmaker | None = None


def _build_engine_kwargs(database_url: str) -> dict:
    kwargs: dict = {"echo": settings.ENVIRONMENT == "development"}

    if "sqlite" in database_url:
        # Test only — SQLite doesn't support pool options
        kwargs["connect_args"] = {"check_same_thread": False}
        return kwargs

    kwargs.update({
        # FIX: was pool_size=10, max_overflow=20 — too small for Cloud Run 10k req/s
        # With 20 Cloud Run instances × 20 connections = 400 max DB connections.
        # PgBouncer / Cloud SQL Proxy should be in front to pool to ~100.
        "pool_size":        settings.DB_POOL_SIZE,        # default 20
        "max_overflow":     settings.DB_POOL_MAX_OVERFLOW, # default 40
        "pool_timeout":     30,    # max seconds to wait for a connection from pool
        "pool_pre_ping":    True,  # reconnect on stale connections (Cloud Run idles)
        "pool_recycle":     1800,  # recycle connections every 30 min
    })
    return kwargs


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            **_build_engine_kwargs(settings.DATABASE_URL),
        )

        # Set statement_timeout on every new connection — prevents runaway queries
        # from blocking the entire pool under high load
        if "sqlite" not in settings.DATABASE_URL:
            @event.listens_for(_engine.sync_engine, "connect")
            def set_timeouts(dbapi_conn, connection_record):
                cursor = dbapi_conn.cursor()
                cursor.execute("SET statement_timeout = '30000'")  # 30 seconds
                cursor.execute("SET idle_in_transaction_session_timeout = '60000'")  # 60s
                cursor.close()

        logger.info(
            "DB engine created: pool_size=%d max_overflow=%d",
            settings.DB_POOL_SIZE, settings.DB_POOL_MAX_OVERFLOW,
        )
    return _engine


def get_session_factory() -> async_sessionmaker:
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


# Backwards-compat alias
class _LazySessionFactory:
    def __call__(self, *args, **kwargs):
        return get_session_factory()(*args, **kwargs)
    def __getattr__(self, name):
        return getattr(get_session_factory(), name)

AsyncSessionLocal = _LazySessionFactory()


# ── Global soft-delete filter ─────────────────────────────────────────────────

@event.listens_for(Session, "do_orm_execute")
def _add_soft_delete_filter(execute_state):
    """
    Transparently filter out soft-deleted records (deleted_at IS NOT NULL).
    Applied to every SELECT so callers never need to add the filter manually.
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
    """
    FastAPI dependency: yields an async DB session.
    Auto-commits on success, rolls back on exception.
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


# ── Health check ──────────────────────────────────────────────────────────────

async def check_db_health() -> dict:
    try:
        async with get_session_factory()() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "healthy"}
    except Exception as exc:
        logger.error("DB health check failed: %s", exc)
        return {"status": "unhealthy", "error": str(exc)}
