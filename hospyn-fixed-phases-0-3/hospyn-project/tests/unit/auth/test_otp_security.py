"""
tests/unit/auth/test_otp_security.py
=====================================
Unit tests for OTP brute-force protection.
These run without a real Redis — uses fakeredis.
Install: pip install fakeredis
"""
import time
import pytest
import asyncio

# ── Fake Redis (in-memory, no real Redis needed for unit tests) ───────────────
try:
    import fakeredis.aioredis as fakeredis
    FAKEREDIS_AVAILABLE = True
except ImportError:
    FAKEREDIS_AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not FAKEREDIS_AVAILABLE,
    reason="fakeredis not installed — run: pip install fakeredis"
)


@pytest.fixture
async def redis():
    """Provide a fresh in-memory Redis for each test."""
    r = fakeredis.FakeRedis()
    yield r
    await r.flushall()
    await r.aclose()


@pytest.fixture
def otp_security():
    """Import the module under test."""
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../backend/auth-service"))
    from app.core.otp_security import (
        store_otp, verify_otp_with_protection,
        check_otp_lockout, MAX_OTP_ATTEMPTS
    )
    return {
        "store_otp": store_otp,
        "verify_otp": verify_otp_with_protection,
        "check_lockout": check_otp_lockout,
        "MAX_ATTEMPTS": MAX_OTP_ATTEMPTS,
    }


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_correct_otp_succeeds(redis, otp_security):
    """A correct OTP submitted within expiry window must succeed."""
    phone = "+919876543210"
    await otp_security["store_otp"](phone, "123456", redis)
    result = await otp_security["verify_otp"](phone, "123456", redis)
    assert result is True


@pytest.mark.asyncio
async def test_wrong_otp_raises_401(redis, otp_security):
    """A wrong OTP must raise HTTP 401."""
    from fastapi import HTTPException
    phone = "+919876543211"
    await otp_security["store_otp"](phone, "123456", redis)

    with pytest.raises(HTTPException) as exc:
        await otp_security["verify_otp"](phone, "999999", redis)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_lockout_after_max_attempts(redis, otp_security):
    """After MAX_ATTEMPTS wrong OTPs, account must be locked (HTTP 429)."""
    from fastapi import HTTPException
    phone = "+919876543212"
    await otp_security["store_otp"](phone, "123456", redis)

    # Submit MAX_ATTEMPTS - 1 wrong OTPs
    for i in range(otp_security["MAX_ATTEMPTS"] - 1):
        # Re-store OTP each time (previous failed attempt doesn't delete it)
        await redis.hset(f"otp:{phone}", mapping={
            "code": "123456",
            "created_at": str(time.time()),
        })
        await redis.expire(f"otp:{phone}", 600)
        try:
            await otp_security["verify_otp"](phone, "000000", redis)
        except HTTPException:
            pass

    # Re-store OTP for final attempt
    await redis.hset(f"otp:{phone}", mapping={
        "code": "123456",
        "created_at": str(time.time()),
    })
    await redis.expire(f"otp:{phone}", 600)

    # Final wrong attempt should trigger lockout
    with pytest.raises(HTTPException) as exc:
        await otp_security["verify_otp"](phone, "000000", redis)
    assert exc.value.status_code == 429
    assert "locked" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_locked_account_rejects_correct_otp(redis, otp_security):
    """Even correct OTP must be rejected while account is locked."""
    from fastapi import HTTPException
    phone = "+919876543213"
    # Manually set lockout
    await redis.setex(f"otp_lockout:{phone}", 1800, "1")

    with pytest.raises(HTTPException) as exc:
        await otp_security["check_lockout"](phone, redis)
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_otp_cleared_after_success(redis, otp_security):
    """After successful verification, OTP must be deleted from Redis."""
    phone = "+919876543214"
    await otp_security["store_otp"](phone, "123456", redis)
    await otp_security["verify_otp"](phone, "123456", redis)

    # OTP key should be gone
    exists = await redis.exists(f"otp:{phone}")
    assert exists == 0, "OTP key should be deleted after successful verification"


@pytest.mark.asyncio
async def test_missing_otp_raises_400(redis, otp_security):
    """Verifying OTP that was never stored must raise HTTP 400."""
    from fastapi import HTTPException
    phone = "+919876543215"  # Never called store_otp

    with pytest.raises(HTTPException) as exc:
        await otp_security["verify_otp"](phone, "123456", redis)
    assert exc.value.status_code == 400
    assert "expired" in exc.value.detail.lower() or "never" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_otp_request_cooldown(redis, otp_security):
    """Cannot request two OTPs back-to-back (cooldown enforced)."""
    from fastapi import HTTPException
    phone = "+919876543216"
    await otp_security["store_otp"](phone, "111111", redis)

    # Second request immediately after should fail
    with pytest.raises(HTTPException) as exc:
        await otp_security["store_otp"](phone, "222222", redis)
    assert exc.value.status_code == 429
