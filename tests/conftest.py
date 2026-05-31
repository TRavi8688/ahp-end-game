"""
tests/conftest.py
=================
Test configuration and shared fixtures.
Sets up in-memory test database and HTTP client.
"""
import asyncio
import pytest
from httpx import AsyncClient, ASGITransport


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def anyio_backend():
    return "asyncio"
