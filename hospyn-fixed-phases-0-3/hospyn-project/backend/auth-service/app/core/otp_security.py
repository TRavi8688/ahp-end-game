"""
backend/auth-service/app/core/otp_security.py
==============================================
FIXES APPLIED:
  - OTP brute-force protection (5 attempts → 30-min lockout)
  - OTP expiry enforced (5 minutes)
  - Attempt counter stored in Redis (survives server restart)
  - Returns informative but safe error messages
"""

import time
import logging
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
MAX_OTP_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 30 * 60   # 30 minutes
OTP_EXPIRY_SECONDS = 5 * 60          # 5 minutes — OTP invalid after this
OTP_REQUEST_COOLDOWN_SECONDS = 60    # Must wait 60s before requesting new OTP


async def check_otp_lockout(phone: str, redis) -> None:
    """
    Raises HTTP 429 if the phone number is currently locked out.
    Call this BEFORE attempting OTP verification.
    """
    lockout_key = f"otp_lockout:{phone}"
    locked = await redis.exists(lockout_key)
    if locked:
        ttl = await redis.ttl(lockout_key)
        minutes_remaining = max(1, ttl // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Account temporarily locked due to too many failed OTP attempts. "
                f"Try again in {minutes_remaining} minute(s)."
            ),
            headers={"Retry-After": str(ttl)},
        )


async def verify_otp_with_protection(
    phone: str,
    submitted_otp: str,
    redis,
) -> bool:
    """
    Verifies an OTP with full brute-force protection.

    Flow:
      1. Check lockout
      2. Retrieve stored OTP + timestamp from Redis
      3. Check expiry (5 min)
      4. Compare OTP
      5. On failure: increment attempt counter, lock after MAX_OTP_ATTEMPTS
      6. On success: clear attempt counter and OTP

    Returns True on success.
    Raises HTTPException on any failure.
    """
    otp_key = f"otp:{phone}"
    attempt_key = f"otp_attempts:{phone}"
    lockout_key = f"otp_lockout:{phone}"

    # ── Step 1: Check lockout ─────────────────────────────────────────────────
    await check_otp_lockout(phone, redis)

    # ── Step 2: Get stored OTP data ───────────────────────────────────────────
    otp_data = await redis.hgetall(otp_key)
    if not otp_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired or was never requested. Please request a new OTP.",
        )

    stored_otp = otp_data.get(b"code", b"").decode()
    created_at = float(otp_data.get(b"created_at", b"0").decode())

    # ── Step 3: Check expiry ──────────────────────────────────────────────────
    age_seconds = time.time() - created_at
    if age_seconds > OTP_EXPIRY_SECONDS:
        await redis.delete(otp_key)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one.",
        )

    # ── Step 4: Compare OTP ───────────────────────────────────────────────────
    if stored_otp != submitted_otp.strip():
        # Increment attempt counter
        attempts = await redis.incr(attempt_key)
        await redis.expire(attempt_key, LOCKOUT_DURATION_SECONDS)

        remaining = MAX_OTP_ATTEMPTS - attempts
        logger.warning(
            "Failed OTP attempt",
            extra={"phone_hash": hash(phone), "attempts": attempts},
        )

        if remaining <= 0:
            # Lock the account
            await redis.setex(lockout_key, LOCKOUT_DURATION_SECONDS, "1")
            await redis.delete(attempt_key, otp_key)
            logger.warning(
                "OTP lockout triggered",
                extra={"phone_hash": hash(phone)},
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Too many failed attempts. Account locked for 30 minutes. "
                    "Contact support if you need immediate access."
                ),
                headers={"Retry-After": str(LOCKOUT_DURATION_SECONDS)},
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid OTP. {remaining} attempt(s) remaining before lockout.",
        )

    # ── Step 5: Success — clear everything ───────────────────────────────────
    await redis.delete(otp_key, attempt_key)
    logger.info("OTP verified successfully", extra={"phone_hash": hash(phone)})
    return True


async def store_otp(phone: str, otp_code: str, redis) -> None:
    """
    Stores a new OTP in Redis with a timestamp.
    Enforces request cooldown (can't spam OTP requests).
    """
    cooldown_key = f"otp_cooldown:{phone}"

    # Check cooldown — prevent OTP spam
    if await redis.exists(cooldown_key):
        ttl = await redis.ttl(cooldown_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {ttl} second(s) before requesting a new OTP.",
            headers={"Retry-After": str(ttl)},
        )

    otp_key = f"otp:{phone}"
    await redis.hset(otp_key, mapping={
        "code": otp_code,
        "created_at": str(time.time()),
    })
    await redis.expire(otp_key, OTP_EXPIRY_SECONDS + 30)  # Slightly longer than expiry check

    # Set cooldown
    await redis.setex(cooldown_key, OTP_REQUEST_COOLDOWN_SECONDS, "1")
