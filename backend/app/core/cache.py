"""
cache.py — Redis client with authentication and connection health check.
Phase 14 Fix: "Redis unauthenticated (OTP theft possible)" — adds password auth.

Place at: backend/app/core/cache.py (replace or create)
"""
import os
from typing import Optional

import redis.asyncio as aioredis
from redis.asyncio import Redis
from redis.exceptions import ConnectionError, AuthenticationError

from backend.app.core.logging_config import get_logger

logger = get_logger(__name__)

_redis_client: Optional[Redis] = None


def _build_redis_url() -> str:
    """
    Build authenticated Redis URL.
    Phase 14 Fix: Redis must require password in all non-test environments.
    """
    env = os.environ.get("ENV", "production").lower()
    redis_url = os.environ.get("REDIS_URL", "")

    if redis_url:
        # Explicit URL provided (docker-compose or Cloud Run)
        if env in ("production", "staging") and "://:@" not in redis_url and "@" not in redis_url:
            # URL has no password — warn loudly
            logger.warning(
                "redis_no_password_in_url",
                hint="Set REDIS_URL=redis://:PASSWORD@host:6379/0 for security",
            )
        return redis_url

    # Build from components
    host = os.environ.get("REDIS_HOST", "localhost")
    port = int(os.environ.get("REDIS_PORT", "6379"))
    db = int(os.environ.get("REDIS_DB", "0"))
    password = os.environ.get("REDIS_PASSWORD", "")

    if not password and env in ("production", "staging"):
        logger.critical(
            "redis_password_not_set",
            message="CRITICAL: Redis has no password in production. OTP theft is possible.",
        )

    if password:
        return f"redis://:{password}@{host}:{port}/{db}"
    return f"redis://{host}:{port}/{db}"


async def get_redis_client() -> Redis:
    """
    Returns authenticated Redis client (singleton).
    Raises ConnectionError if Redis is unreachable.
    """
    global _redis_client

    if _redis_client is None:
        url = _build_redis_url()
        _redis_client = aioredis.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )

    return _redis_client


async def check_redis_health() -> dict:
    """Used by /health endpoint."""
    try:
        client = await get_redis_client()
        await client.ping()
        return {"status": "healthy"}
    except (ConnectionError, AuthenticationError) as e:
        logger.error("redis_health_check_failed", error=str(e))
        return {"status": "unhealthy", "error": str(e)}


# ── OTP helpers ───────────────────────────────────────────────────────────────

OTP_TTL_SECONDS = 300       # 5 minutes
OTP_MAX_ATTEMPTS = 5        # Lock after 5 failures
OTP_LOCKOUT_SECONDS = 900   # 15-minute lockout


async def store_otp_hash(phone: str, otp_hash: str) -> None:
    """Store HMAC-SHA256 OTP hash in Redis with TTL."""
    client = await get_redis_client()
    key = f"otp:hash:{phone}"
    await client.setex(key, OTP_TTL_SECONDS, otp_hash)
    # Reset attempt counter on new OTP
    await client.delete(f"otp:attempts:{phone}")


async def get_otp_hash(phone: str) -> Optional[str]:
    """Retrieve stored OTP hash. Returns None if expired."""
    client = await get_redis_client()
    return await client.get(f"otp:hash:{phone}")


async def increment_otp_attempts(phone: str) -> int:
    """
    Increment failed OTP attempt counter.
    Returns current attempt count (triggers lockout at OTP_MAX_ATTEMPTS).
    """
    client = await get_redis_client()
    key = f"otp:attempts:{phone}"
    attempts = await client.incr(key)
    if attempts == 1:
        # First attempt — set TTL for the counter
        await client.expire(key, OTP_LOCKOUT_SECONDS)
    return attempts


async def is_otp_locked(phone: str) -> bool:
    """Check if phone number is locked out due to too many failed attempts."""
    client = await get_redis_client()
    attempts_raw = await client.get(f"otp:attempts:{phone}")
    attempts = int(attempts_raw) if attempts_raw else 0
    return attempts >= OTP_MAX_ATTEMPTS


async def clear_otp(phone: str) -> None:
    """Clear OTP data after successful verification."""
    client = await get_redis_client()
    await client.delete(f"otp:hash:{phone}", f"otp:attempts:{phone}")


# ── Session helpers ───────────────────────────────────────────────────────────

SESSION_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days


async def store_session(user_id: int, session_data: dict) -> str:
    """Store user session and return session ID."""
    import json
    import uuid
    client = await get_redis_client()
    session_id = str(uuid.uuid4())
    key = f"session:{user_id}:{session_id}"
    await client.setex(key, SESSION_TTL_SECONDS, json.dumps(session_data))
    return session_id


async def invalidate_all_sessions(user_id: int) -> int:
    """Invalidate all sessions for a user (used on password change/logout-all)."""
    client = await get_redis_client()
    pattern = f"session:{user_id}:*"
    keys = await client.keys(pattern)
    if keys:
        return await client.delete(*keys)
    return 0
