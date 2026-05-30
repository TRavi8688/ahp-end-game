"""
Shared Redis Client — Async connection pool with token blacklisting & rate limiting.

Used by:
- Auth Service: blacklist tokens on logout/password change
- Healthcare Core: check blacklist before accepting JWT
- Both: rate limiting via sliding window

Design: Fail-open — if Redis is unavailable, operations log warnings
and allow requests through (security degrades but service stays up).
"""

import logging
import redis.asyncio as aioredis
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# ─── Global Connection Pool ──────────────────────────────────────
_redis_pool: Optional[aioredis.Redis] = None


async def init_redis(redis_url: str) -> None:
    """Initialize the Redis connection pool. Call once at service startup."""
    global _redis_pool
    try:
        _redis_pool = aioredis.from_url(
            redis_url,
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
        # Verify connectivity
        await _redis_pool.ping()
        logger.info(
            f"Redis connected: {redis_url.split('@')[-1] if '@' in redis_url else redis_url}"
        )
    except Exception as e:
        _redis_pool = None
        raise ConnectionError(f"Redis connection failed: {e}") from e


async def close_redis() -> None:
    """Close the Redis connection pool. Call on service shutdown."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
        logger.info("Redis connection closed.")


def get_redis() -> Optional[aioredis.Redis]:
    """Get the Redis client instance. Returns None if not initialized."""
    return _redis_pool


# ─── Token Blacklist ─────────────────────────────────────────────


async def blacklist_token(jti: str, ttl_seconds: int) -> bool:
    """
    Add a JWT ID to the revocation blacklist.

    Args:
        jti: The JWT ID (jti claim) to blacklist
        ttl_seconds: Time-to-live in seconds (should match remaining token life)

    Returns:
        True if successfully blacklisted, False if Redis unavailable
    """
    if not _redis_pool:
        logger.warning(f"Redis unavailable — cannot blacklist token jti={jti}")
        return False

    try:
        key = f"hospyn:blacklist:{jti}"
        await _redis_pool.setex(key, ttl_seconds, "1")
        logger.debug(f"Token blacklisted: jti={jti}, ttl={ttl_seconds}s")
        return True
    except Exception as e:
        logger.error(f"Failed to blacklist token: {e}")
        return False


async def is_token_blacklisted(jti: str) -> bool:
    """
    Check if a JWT ID has been revoked.

    Returns:
        True if token is blacklisted (revoked).
        False if not blacklisted OR if Redis is unavailable (fail-open).
    """
    if not _redis_pool:
        return False  # Fail-open: allow request if Redis is down

    try:
        key = f"hospyn:blacklist:{jti}"
        result = await _redis_pool.exists(key)
        return bool(result)
    except Exception as e:
        logger.warning(f"Redis blacklist check failed (fail-open): {e}")
        return False  # Fail-open


# ─── Rate Limiting (Sliding Window) ──────────────────────────────


async def rate_limit_check(
    key: str, max_requests: int, window_seconds: int
) -> Tuple[bool, int]:
    """
    Sliding window rate limiter using Redis.

    Args:
        key: Unique identifier (e.g., "login:192.168.1.1")
        max_requests: Maximum requests allowed in the window
        window_seconds: Window size in seconds

    Returns:
        Tuple of (is_allowed: bool, remaining: int)
        If Redis is unavailable, returns (True, max_requests) — fail-open.
    """
    if not _redis_pool:
        return True, max_requests  # Fail-open

    redis_key = f"hospyn:ratelimit:{key}"

    try:
        pipe = _redis_pool.pipeline()
        pipe.incr(redis_key)
        pipe.ttl(redis_key)
        results = await pipe.execute()

        current_count = results[0]
        current_ttl = results[1]

        # Set expiry on first request in window
        if current_ttl == -1:
            await _redis_pool.expire(redis_key, window_seconds)

        remaining = max(0, max_requests - current_count)
        is_allowed = current_count <= max_requests

        return is_allowed, remaining
    except Exception as e:
        logger.warning(f"Rate limit check failed (fail-open): {e}")
        return True, max_requests  # Fail-open


# ─── User Status (Token Version / Active State) ──────────────────


async def publish_user_status(
    user_id: str, is_active: bool, token_version: int, ttl: int = 300
) -> bool:
    """
    Publish user active-state and token version to Redis.
    Used by auth-service after login/password changes so healthcare-core
    can validate tokens without a DB round-trip.
    """
    if not _redis_pool:
        return False
    try:
        key = f"hospyn:user:{user_id}"
        await _redis_pool.hset(
            key,
            mapping={
                "is_active": "1" if is_active else "0",
                "token_version": str(token_version),
            },
        )
        await _redis_pool.expire(key, ttl)
        return True
    except Exception as e:
        logger.warning(f"Failed to publish user status: {e}")
        return False


async def get_user_status(user_id: str) -> dict | None:
    """
    Retrieve cached user status from Redis.
    Returns None on cache miss or Redis unavailability (fail-open).
    """
    if not _redis_pool:
        return None
    try:
        key = f"hospyn:user:{user_id}"
        data = await _redis_pool.hgetall(key)
        return data if data else None
    except Exception as e:
        logger.warning(f"Failed to get user status: {e}")
        return None


_local_consent_tokens = {}


async def set_patient_consent_token(
    patient_id: str, consent_token: str, ttl: int = 900
) -> bool:
    """Store short-lived consent token for appointment bookings."""
    if not _redis_pool:
        _local_consent_tokens[patient_id] = consent_token
        return True
    try:
        key = f"hospyn:patient:consent:{patient_id}"
        await _redis_pool.setex(key, ttl, consent_token)
        return True
    except Exception as e:
        logger.warning(f"Failed to set patient consent token: {e}")
        _local_consent_tokens[patient_id] = consent_token
        return True


async def verify_patient_consent_token(patient_id: str, consent_token: str) -> bool:
    """Verify if a consent token matches the stored one in Redis (one-time use)."""
    if not _redis_pool:
        stored = _local_consent_tokens.get(patient_id, None)
        if stored and stored == consent_token:
            _local_consent_tokens.pop(patient_id, None)
            return True
        return False
    try:
        key = f"hospyn:patient:consent:{patient_id}"
        stored = await _redis_pool.get(key)
        if stored and stored == consent_token:
            await _redis_pool.delete(key)
            return True
        return False
    except Exception as e:
        logger.error(f"Error verifying patient consent token: {e}")
        stored = _local_consent_tokens.get(patient_id, None)
        if stored and stored == consent_token:
            _local_consent_tokens.pop(patient_id, None)
            return True
        return False
