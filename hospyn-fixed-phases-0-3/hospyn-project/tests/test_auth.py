"""
tests/test_auth.py
First test suite for the auth service.
Run with: pytest tests/test_auth.py -v
Requires: pytest, pytest-asyncio, httpx, a test PostgreSQL database
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Update this import to your actual auth app path
# from backend.auth_service.app.main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client():
    """Async HTTP client against the auth app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),  # noqa: F821 — replace with your import
        base_url="http://test"
    ) as c:
        yield c


@pytest_asyncio.fixture
async def registered_user(client: AsyncClient):
    """Register a test user and return their credentials."""
    resp = await client.post("/api/v1/auth/register", json={
        "email": "test@hospyn.com",
        "password": "StrongP@ssw0rd!2024",
        "phone": "+919876543210",
        "name": "Test User",
        "role": "doctor",
    })
    assert resp.status_code == 201, resp.text
    return {"email": "test@hospyn.com", "password": "StrongP@ssw0rd!2024"}


# ---------------------------------------------------------------------------
# Registration tests
# ---------------------------------------------------------------------------

class TestRegistration:
    async def test_register_success(self, client):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "new@hospyn.com",
            "password": "StrongP@ssw0rd!2024",
            "phone": "+919876543211",
            "name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["email"] == "new@hospyn.com"
        assert "hashed_password" not in data  # NEVER return hashed password

    async def test_register_duplicate_email_rejected(self, client, registered_user):
        resp = await client.post("/api/v1/auth/register", json={
            "email": registered_user["email"],
            "password": "AnotherP@ssw0rd!2024",
            "phone": "+919876543212",
            "name": "Duplicate",
        })
        assert resp.status_code == 409

    async def test_register_weak_password_rejected(self, client):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "weak@hospyn.com",
            "password": "password",
            "phone": "+919876543213",
            "name": "Weak",
        })
        assert resp.status_code == 422

    async def test_register_invalid_email_rejected(self, client):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "notanemail",
            "password": "StrongP@ssw0rd!2024",
            "phone": "+919876543214",
            "name": "Bad Email",
        })
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------

class TestLogin:
    async def test_login_success(self, client, registered_user):
        resp = await client.post("/api/v1/auth/login", json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client, registered_user):
        resp = await client.post("/api/v1/auth/login", json={
            "email": registered_user["email"],
            "password": "WrongPassword!2024",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client):
        resp = await client.post("/api/v1/auth/login", json={
            "email": "nobody@hospyn.com",
            "password": "SomeP@ssw0rd!2024",
        })
        assert resp.status_code == 401

    async def test_login_returns_no_plaintext_password(self, client, registered_user):
        resp = await client.post("/api/v1/auth/login", json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        })
        text = resp.text
        assert registered_user["password"] not in text
        assert "hashed_password" not in text


# ---------------------------------------------------------------------------
# OTP tests
# ---------------------------------------------------------------------------

class TestOTP:
    async def test_otp_send_requires_valid_phone(self, client, registered_user):
        resp = await client.post("/api/v1/auth/otp/send", json={
            "phone": "+919876543210"
        })
        assert resp.status_code in (200, 202)

    async def test_otp_invalid_phone_rejected(self, client):
        resp = await client.post("/api/v1/auth/otp/send", json={
            "phone": "notaphone"
        })
        assert resp.status_code == 422

    async def test_otp_wrong_code_rejected(self, client):
        resp = await client.post("/api/v1/auth/otp/verify", json={
            "phone": "+919876543210",
            "otp": "000000"
        })
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Token refresh tests
# ---------------------------------------------------------------------------

class TestTokenRefresh:
    async def test_refresh_with_valid_token(self, client, registered_user):
        login = await client.post("/api/v1/auth/login", json=registered_user)
        refresh_token = login.json()["refresh_token"]

        resp = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_refresh_with_invalid_token_rejected(self, client):
        resp = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": "fake.token.value"
        })
        assert resp.status_code == 401

    async def test_access_token_required_for_protected_routes(self, client):
        resp = await client.get("/api/v1/healthcare/patients")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Security tests
# ---------------------------------------------------------------------------

class TestSecurityHeaders:
    async def test_no_sensitive_headers_in_response(self, client, registered_user):
        login = await client.post("/api/v1/auth/login", json=registered_user)
        assert "x-powered-by" not in login.headers
        assert "server" not in login.headers or "uvicorn" not in login.headers.get("server", "").lower()

    async def test_rate_limiting_on_login(self, client):
        """Brute force protection: 10 failed logins should trigger rate limit."""
        for _ in range(10):
            await client.post("/api/v1/auth/login", json={
                "email": "brute@hospyn.com",
                "password": "WrongP@ss!2024"
            })
        resp = await client.post("/api/v1/auth/login", json={
            "email": "brute@hospyn.com",
            "password": "WrongP@ss!2024"
        })
        assert resp.status_code == 429
