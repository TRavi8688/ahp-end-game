"""
tests/conftest.py — shared fixtures for all test modules
"""
import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Test database — use a separate DB so tests don't touch production data
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://hospyn:hospyn@localhost:5432/hospyn_test"
)


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    # Create all tables
    # async with engine.begin() as conn:
    #     await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db(test_engine):
    """Provide a transactional DB session that rolls back after each test."""
    async with test_engine.connect() as conn:
        await conn.begin()
        session_factory = sessionmaker(conn, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as session:
            yield session
        await conn.rollback()
