# backend/healthcare-core/tests/conftest.py
# DB-7 FIX: Replace SQLite in-memory with a real PostgreSQL test database.
# Requires: TEST_DATABASE_URL env var pointing to a PostgreSQL instance.
# In CI: use docker-compose.test.yml (see below) to spin up postgres before pytest.

import os
import asyncio
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from alembic.config import Config
from alembic import command

from app.core.database import Base, get_db    # adjust path as needed

# ---------------------------------------------------------------------------
# Use TEST_DATABASE_URL — NEVER sqlite:///:memory:
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://test:test@localhost:5432/hospyn_test",
)

# Fail fast — don't let tests silently run against the wrong DB
if "sqlite" in TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL must be a PostgreSQL URL. "
        "SQLite hides PostgreSQL-specific bugs (JSONB, UUID, RETURNING, concurrency). "
        "Set TEST_DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/hospyn_test"
    )


@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the entire test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """Create engine and run Alembic migrations once per test session."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Run migrations (equivalent to alembic upgrade head)
    def run_migrations():
        alembic_cfg = Config("alembic.ini")   # path relative to service root
        alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL.replace(
            "postgresql+asyncpg", "postgresql"  # Alembic uses sync URL
        ))
        command.upgrade(alembic_cfg, "head")

    await asyncio.get_event_loop().run_in_executor(None, run_migrations)

    yield engine

    # Teardown: drop all tables after the session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    """Provide a fresh transactional session per test, rolled back after."""
    async_session = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        async with session.begin():
            yield session
            await session.rollback()  # roll back after each test — no state leaks


@pytest_asyncio.fixture
async def client(db_session):
    """FastAPI test client with DB session overridden."""
    from httpx import AsyncClient
    from app.main import app  # adjust path as needed

    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
