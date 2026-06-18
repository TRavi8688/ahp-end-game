"""
backend/auth-service/tests/conftest.py

Fixtures specific to the auth service test suite.
"""
import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

# ---------------------------------------------------------------------------
# App import — adjust import path to match your auth-service layout
# ---------------------------------------------------------------------------
# from app.main import app                   # uncomment when app exists
# from app.models import User, OtpVerification
# from app.database import get_db
# from app.core.security import create_access_token

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://hospyn_test:test_password@localhost:5432/hospyn_test",
)

engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool, echo=False)
AsyncTestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# DB session — SAVEPOINT rollback pattern
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        await conn.begin_nested()
        yield session
        await session.close()
        await conn.rollback()


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    AsyncClient pointed at the auth-service FastAPI app.
    Overrides the DB dependency so every request uses the test session.
    """
    # Uncomment and adjust when app is importable:
    #
    # async def override_get_db():
    #     yield db_session
    #
    # app.dependency_overrides[get_db] = override_get_db
    # async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
    #     yield ac
    # app.dependency_overrides.clear()
    #
    # For now yield a plain client so tests are importable/runnable:
    async with AsyncClient(base_url="http://localhost:8001") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Reusable test user
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    """
    Inserts a minimal verified user row and returns it.
    Replace with your actual ORM model when available.
    """
    from sqlalchemy import text

    phone = "+919876543210"
    await db_session.execute(
        text(
            """
            INSERT INTO users (phone_number, is_verified, token_version, created_at)
            VALUES (:phone, true, 0, NOW())
            ON CONFLICT (phone_number) DO UPDATE SET is_verified = true
            """
        ),
        {"phone": phone},
    )
    await db_session.flush()

    row = await db_session.execute(
        text("SELECT * FROM users WHERE phone_number = :phone"), {"phone": phone}
    )
    return row.mappings().one()


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------
@pytest.fixture
def mock_sms_gateway():
    """Patches the SMS dispatch so tests never hit Twilio/MSG91."""
    with patch("app.services.sms.send_otp_sms", new_callable=AsyncMock) as mock:
        mock.return_value = {"status": "queued", "sid": "SM_test_sid"}
        yield mock


@pytest.fixture
def mock_redis():
    """Patches Redis rate-limit calls for tests that don't need real Redis."""
    with patch("app.core.rate_limit.redis_client") as mock_r:
        mock_r.incr = AsyncMock(return_value=1)
        mock_r.expire = AsyncMock(return_value=True)
        mock_r.get = AsyncMock(return_value=None)
        yield mock_r
