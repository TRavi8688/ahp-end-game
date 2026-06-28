"""
database.py -- Production PostgreSQL configuration with async engine + PgBouncer.
Phase 14 Fix: replaces SQLite (which "corrupts under write load at 100 users")
with async PostgreSQL + connection pooling.

Place at: backend/app/core/database.py (replace existing file)
"""
import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.pool import NullPool
from sqlalchemy import event, text

from backend.app.core.logging_config import get_logger

logger = get_logger(__name__)

# --- Connection URL -----------------------------------------------------------

def _get_database_url() -> str:
    """
    Phase 14 Fix: Production must use PostgreSQL.
    Falls back to SQLite only in test environment.
    """
    env = os.environ.get("ENV", "production").lower()
    db_url = os.environ.get("DATABASE_URL", "")

    if not db_url:
        if env == "test":
            return "sqlite+aiosqlite:///:memory:"
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Set it to: postgresql+asyncpg://user:pass@localhost:5432/hospyn"
        )

    # Enforce PostgreSQL in production/staging
    if env in ("production", "staging"):
        if "sqlite" in db_url.lower():
            raise RuntimeError(
                f"SQLite is NOT allowed in {env} environment. "
                "Use PostgreSQL: postgresql+asyncpg://user:pass@host:5432/hospyn"
            )

    # SQLAlchemy 2.x requires asyncpg driver for async PostgreSQL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    return db_url


# --- Engine configuration -----------------------------------------------------

def _create_engine() -> AsyncEngine:
    """
    Create async SQLAlchemy engine with production-grade settings.

    Phase 14 Fix:
    - Pool size tuned for Cloud Run concurrency
    - PgBouncer compatibility (NullPool for PgBouncer transaction mode)
    - Connection health checks
    - Statement timeout to prevent hung queries
    """
    db_url = _get_database_url()
    env = os.environ.get("ENV", "production").lower()

    # PgBouncer in transaction mode is incompatible with SQLAlchemy's connection pool
    # (PgBouncer manages pooling at the proxy level). Use NullPool when PgBouncer is present.
    use_pgbouncer = os.environ.get("USE_PGBOUNCER", "false").lower() == "true"

    common_kwargs = dict(
        echo=env == "development",
        echo_pool=False,
    )

    if "sqlite" in db_url:
        # Test/dev: SQLite doesn't support all pool options
        return create_async_engine(
            db_url,
            connect_args={"check_same_thread": False},
            **common_kwargs,
        )

    if use_pgbouncer:
        # PgBouncer: let PgBouncer handle the pool; SQLAlchemy uses NullPool
        engine = create_async_engine(
            db_url,
            poolclass=NullPool,
            **common_kwargs,
        )
    else:
        # Direct PostgreSQL: SQLAlchemy manages pool
        # Tuned for Cloud Run: max_concurrent_requests * 2 + headroom
        pool_size = int(os.environ.get("DB_POOL_SIZE", "20"))
        max_overflow = int(os.environ.get("DB_POOL_MAX_OVERFLOW", "40"))

        engine = create_async_engine(
            db_url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_timeout=30,              # Wait max 30s for a connection
            pool_recycle=1800,            # Recycle connections every 30 min
            pool_pre_ping=True,           # Test connection before using (catches stale connections)
            **common_kwargs,
        )

    # Set statement timeout (prevents hung queries from blocking the pool)
    @event.listens_for(engine.sync_engine, "connect")
    def set_statement_timeout(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("SET statement_timeout = '30s'")
        cursor.close()

    return engine


# --- Session factory ----------------------------------------------------------

engine: AsyncEngine = _create_engine()

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevents lazy-load errors after commit
    autocommit=False,
    autoflush=False,
)


# --- FastAPI dependency -------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency: yields an async DB session, auto-commits or rolls back.

    Usage:
        @router.get("/patients")
        async def list_patients(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# --- Health check helper ------------------------------------------------------

async def check_db_health() -> dict:
    """Used by /health endpoint (Phase 12)."""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar()
        return {"status": "healthy"}
    except Exception as e:
        logger.error("db_health_check_failed", error=str(e))
        return {"status": "unhealthy", "error": str(e)}


# --- Startup/shutdown lifecycle -----------------------------------------------

async def startup_db() -> None:
    """Call in FastAPI lifespan startup."""
    health = await check_db_health()
    if health["status"] != "healthy":
        from backend.app.core.alerting import alert_database_down
        await alert_database_down(health.get("error", "unknown"))
        raise RuntimeError("Database is unreachable at startup -- aborting.")
    logger.info("database_connected", url=_get_database_url().split("@")[-1])  # Log host only, not credentials


async def shutdown_db() -> None:
    """Call in FastAPI lifespan shutdown."""
    await engine.dispose()
    logger.info("database_connection_pool_closed")
