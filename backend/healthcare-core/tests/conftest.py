"""
Pytest configuration and shared fixtures for healthcare-core integration tests.

Uses an in-memory SQLite database (via aiosqlite) so tests run without a
real Postgres instance.  The FastAPI `get_db` dependency is overridden per-test
to point at the temporary test database.
"""

import os
import sys
import pytest
import asyncio
from typing import AsyncGenerator

import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

# Ensure correct python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import Base, get_db
from app.config.settings import settings

# Override settings for testing
settings.ENVIRONMENT = "testing"
settings.REDIS_URL = "redis://localhost:6379/15"
settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# ── In-memory SQLite test database ──────────────────────────────────────────

TEST_DATABASE_URL = settings.DATABASE_URL

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=True,
)


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def init_db():
    """Create all tables in the in-memory test database."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture(autouse=True)
def override_db_dependency(db_session):
    """Override the real get_db with the test session for every test."""

    async def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """
    Provide an httpx.AsyncClient configured to talk to the FastAPI app.

    httpx >= 0.28 removed the `app` kwarg — use ASGITransport instead.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
