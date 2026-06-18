"""
backend/auth-service/tests/test_auth_flow.py

Integration tests for the complete authentication flow.
Covers: OTP registration, rate limiting, token expiry, token versioning,
wrong OTP, and wrong password.

All tests use the SAVEPOINT rollback pattern — no data persists between tests.
"""
import asyncio
import os
import time
from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _register_and_get_otp(client: AsyncClient, phone: str) -> str:
    """
    Calls POST /auth/register, then retrieves the OTP from the test endpoint
    (or from the mock — whichever pattern the service exposes in test mode).
    Returns the raw OTP string.
    """
    reg_resp = await client.post("/auth/register", json={"phone_number": phone})
    assert reg_resp.status_code in (200, 201), (
        f"Register failed: {reg_resp.status_code} {reg_resp.text}"
    )

    # In test mode the service should expose the generated OTP directly so
    # we don't need to intercept SMS.  Adjust the key name to match your API.
    otp = reg_resp.json().get("otp") or reg_resp.json().get("debug_otp")
    assert otp, "Expected OTP in response body during test mode"
    return otp


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestOtpRegistrationFlow:
    """Happy path and basic error paths for OTP-based registration."""

    @pytest.mark.asyncio
    async def test_complete_otp_registration_flow(self, client: AsyncClient, db_session):
        """
        Happy path — new user registers via OTP:
          1. POST /auth/register with phone_number → 200/201
          2. Receive OTP in response (test mode)
          3. POST /auth/otp-verify with correct OTP → 200 + JWT
          4. Use JWT on a protected endpoint → 200
        """
        phone = "+919000000001"

        # Step 1 & 2 — register, get OTP
        otp = await _register_and_get_otp(client, phone)

        # Step 3 — verify OTP
        verify_resp = await client.post(
            "/auth/otp-verify", json={"phone_number": phone, "otp": otp}
        )
        assert verify_resp.status_code == 200, (
            f"OTP verify failed: {verify_resp.status_code} {verify_resp.text}"
        )

        data = verify_resp.json()
        assert "access_token" in data, "No access_token in verify response"
        assert data.get("token_type", "bearer").lower() == "bearer"

        token = data["access_token"]

        # Step 4 — use token on a protected endpoint
        me_resp = await client.get(
            "/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert me_resp.status_code == 200, (
            f"Protected endpoint rejected valid token: {me_resp.text}"
        )

    @pytest.mark.asyncio
    async def test_wrong_otp_returns_401(self, client: AsyncClient):
        """
        Register → request OTP → submit deliberately wrong OTP → 401.
        """
        phone = "+919000000002"
        await _register_and_get_otp(client, phone)

        verify_resp = await client.post(
            "/auth/otp-verify",
            json={"phone_number": phone, "otp": "000000"},  # wrong
        )
        assert verify_resp.status_code == 401, (
            f"Expected 401 for wrong OTP, got {verify_resp.status_code}"
        )
        body = verify_resp.json()
        assert "detail" in body or "message" in body, "Error response missing detail/message"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, db_session, test_user):
        """
        Password-based login (if supported) with wrong password → 401.
        If the service is OTP-only, this tests a deliberately wrong OTP on the
        login endpoint instead.
        """
        resp = await client.post(
            "/auth/login",
            json={
                "phone_number": test_user["phone_number"],
                "password": "definitelyWrong!999",
            },
        )
        assert resp.status_code == 401, (
            f"Expected 401 for wrong password, got {resp.status_code}"
        )


class TestRateLimiting:
    """OTP request rate limiting."""

    @pytest.mark.asyncio
    async def test_otp_rate_limiting(self, client: AsyncClient):
        """
        Send 6 OTP requests for the same phone within 60 s → 6th must be 429.
        Uses mock_redis so the test doesn't depend on a real Redis instance.
        """
        phone = "+919000000003"
        limit = 5  # adjust to match your configured OTP_RATE_LIMIT

        # Patch redis to increment a counter normally
        call_count = 0

        async def fake_incr(key):
            nonlocal call_count
            call_count += 1
            return call_count

        with patch("app.core.rate_limit.redis_client") as mock_r:
            mock_r.incr = AsyncMock(side_effect=fake_incr)
            mock_r.expire = AsyncMock(return_value=True)
            mock_r.get = AsyncMock(return_value=None)

            responses = []
            for _ in range(limit + 1):
                r = await client.post("/auth/register", json={"phone_number": phone})
                responses.append(r.status_code)

        # First `limit` requests succeed; the (limit+1)-th must be 429
        assert all(s in (200, 201) for s in responses[:limit]), (
            f"Early requests should succeed: {responses[:limit]}"
        )
        assert responses[limit] == 429, (
            f"Expected 429 on request {limit + 1}, got {responses[limit]}"
        )


class TestTokenSecurity:
    """JWT expiry and version-based revocation."""

    @pytest.mark.asyncio
    async def test_expired_token_rejected(self, client: AsyncClient, db_session):
        """
        Issue a token with 1-second TTL, wait 2 seconds, use it → 401.
        """
        # We patch create_access_token to use a very short expiry.
        # Adjust the import path to match your auth service.
        phone = "+919000000004"
        otp = await _register_and_get_otp(client, phone)

        with patch("app.core.security.ACCESS_TOKEN_EXPIRE_MINUTES", new=0):
            # Force expiry delta to 1 second
            with patch(
                "app.core.security.timedelta",
                return_value=timedelta(seconds=1),
            ):
                verify_resp = await client.post(
                    "/auth/otp-verify", json={"phone_number": phone, "otp": otp}
                )

        assert verify_resp.status_code == 200
        short_lived_token = verify_resp.json()["access_token"]

        # Wait for the token to expire
        await asyncio.sleep(2)

        me_resp = await client.get(
            "/auth/me", headers={"Authorization": f"Bearer {short_lived_token}"}
        )
        assert me_resp.status_code == 401, (
            f"Expired token should be rejected with 401, got {me_resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_token_revocation_via_version(
        self, client: AsyncClient, db_session, test_user
    ):
        """
        Obtain a valid token → increment token_version in DB → use old token → 401.
        The version claim in the JWT must be validated server-side.
        """
        from sqlalchemy import text

        phone = test_user["phone_number"]
        otp = await _register_and_get_otp(client, phone)

        verify_resp = await client.post(
            "/auth/otp-verify", json={"phone_number": phone, "otp": otp}
        )
        assert verify_resp.status_code == 200
        old_token = verify_resp.json()["access_token"]

        # Revoke all sessions by bumping token_version
        await db_session.execute(
            text(
                "UPDATE users SET token_version = token_version + 1 "
                "WHERE phone_number = :phone"
            ),
            {"phone": phone},
        )
        await db_session.flush()

        # Old token should now be rejected
        me_resp = await client.get(
            "/auth/me", headers={"Authorization": f"Bearer {old_token}"}
        )
        assert me_resp.status_code == 401, (
            f"Token with stale version should be rejected, got {me_resp.status_code}"
        )
