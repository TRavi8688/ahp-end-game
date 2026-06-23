"""
conftest.py — Shared pytest fixtures for Hospyn test suite.
Phase 11 Fix: provides DB, client, auth tokens, and mock services.
"""
import os
import sys
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

# Monkeypatch bcrypt to support passlib on newer python-bcrypt versions
try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        class About:
            __version__ = bcrypt.__version__
        bcrypt.__about__ = About()
except ImportError:
    pass


# ─── Add repo root and backend to Python path so 'backend' or 'app' can be imported ─────────
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(root_dir, "backend"))
sys.path.insert(0, root_dir)


# ─── Force test environment ───────────────────────────────────────────────────
os.environ.setdefault("ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-signing-key-must-be-32-chars-long!!")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("ENCRYPTION_KEY", "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1jaGFycw==")


# ─── Database fixtures ────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def test_db():
    """In-memory SQLite database for each test function."""
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Import and create tables
    try:
        from backend.app.models.base import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except ImportError:
        pass  # Models may not be importable in isolated test runs

    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(test_db):
    """Async test client wired to the FastAPI app."""
    from httpx import AsyncClient, ASGITransport

    try:
        from backend.app.main import app
        from backend.app.core.database import get_db

        async def override_get_db():
            yield test_db

        app.dependency_overrides[get_db] = override_get_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

        app.dependency_overrides.clear()
    except ImportError:
        # Fallback: return a mock client for unit tests that don't need full app
        yield AsyncMock()


# ─── Auth fixtures ────────────────────────────────────────────────────────────

@pytest.fixture
def mock_patient_user():
    return {
        "id": 1,
        "email": "patient@hospyn.test",
        "role": "patient",
        "hospital_id": "hosp_001",
        "is_active": True,
        "token_version": 1,
    }


@pytest.fixture
def mock_doctor_user():
    return {
        "id": 2,
        "email": "doctor@hospyn.test",
        "role": "doctor",
        "hospital_id": "hosp_001",
        "is_active": True,
        "token_version": 1,
    }


@pytest.fixture
def mock_admin_user():
    return {
        "id": 3,
        "email": "admin@hospyn.test",
        "role": "admin",
        "hospital_id": "hosp_001",
        "is_active": True,
        "token_version": 1,
    }


@pytest.fixture
def patient_token(mock_patient_user):
    """Generate a valid JWT for patient role."""
    from jose import jwt
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    payload = {
        **mock_patient_user,
        "exp": now + timedelta(hours=1),
        "iat": now,
        "sub": str(mock_patient_user["id"]),
    }
    return jwt.encode(payload, os.environ["SECRET_KEY"], algorithm="HS256")


@pytest.fixture
def doctor_token(mock_doctor_user):
    from jose import jwt
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    payload = {
        **mock_doctor_user,
        "exp": now + timedelta(hours=1),
        "iat": now,
        "sub": str(mock_doctor_user["id"]),
    }
    return jwt.encode(payload, os.environ["SECRET_KEY"], algorithm="HS256")


@pytest.fixture
def expired_token(mock_patient_user):
    """Token that is already expired — for rejection tests."""
    from jose import jwt
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    payload = {
        **mock_patient_user,
        "exp": now - timedelta(hours=1),
        "iat": now - timedelta(hours=2),
        "sub": str(mock_patient_user["id"]),
    }
    return jwt.encode(payload, os.environ["SECRET_KEY"], algorithm="HS256")


# ─── Redis mock ──────────────────────────────────────────────────────────────

@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    redis.exists = AsyncMock(return_value=0)
    redis.expire = AsyncMock(return_value=True)
    return redis


# ─── Encryption fixture ───────────────────────────────────────────────────────

@pytest.fixture
def fernet_key():
    """Return a valid Fernet key for encryption tests."""
    from cryptography.fernet import Fernet
    return Fernet.generate_key()
