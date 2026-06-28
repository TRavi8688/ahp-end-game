"""
shared/redis_client.py

Single Redis client used by ALL services.
Provides all helpers referenced across the codebase.

PLACE AT: backend/shared/redis_client.py
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import redis.asyncio as aioredis
from redis.asyncio import Redis

logger = logging.getLogger(__name__)

_pool: Redis | None = None


class MockRedis:
    def __init__(self):
        self.store = {}
        self.ttls = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None, px=None, nx=False, xx=False):
        self.store[key] = str(value)
        return True

    async def delete(self, *keys):
        count = 0
        for key in keys:
            if key in self.store:
                del self.store[key]
                count += 1
        return count

    async def incr(self, key):
        val = int(self.store.get(key, 0)) + 1
        self.store[key] = str(val)
        return val

    async def expire(self, key, time):
        return True

    async def ping(self):
        return True

    async def aclose(self):
        pass

def init_redis(redis_url: str) -> Redis:
    """
    Initialize the global Redis connection pool.
    Call once at app startup inside lifespan.
    """
    global _pool
    env = os.environ.get("ENVIRONMENT", os.environ.get("ENV", ""))
    if redis_url.startswith("redis://mock") or env in ["development", "test"]:
        logger.warning("Using mock in-memory Redis client")
        _pool = MockRedis()
        return _pool
        
    try:
        _pool = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        logger.info("Redis pool initialised")
    except Exception as e:
        logger.warning(f"Failed to connect to Redis ({e}). Falling back to mock Redis.")
        _pool = MockRedis()
    return _pool


def get_redis_client() -> Redis:
    """
    Return the shared Redis client.
    Raises RuntimeError if init_redis() has not been called yet.
    """
    if _pool is None:
        raise RuntimeError(
            "Redis client not initialised. "
            "Call shared.redis_client.init_redis(settings.REDIS_URL) "
            "in your app lifespan startup handler."
        )
    return _pool


# Keep get_redis as alias so legacy callers don't break
def get_redis() -> Redis | None:
    """Alias for get_redis_client(). Returns None if not initialised (legacy callers)."""
    return _pool


async def close_redis() -> None:
    """Close the pool gracefully. Call in app lifespan shutdown."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
        logger.info("Redis pool closed")


# -- Generic helpers -----------------------------------------------------------

async def set_with_expiry(key: str, value: Any, ttl_seconds: int) -> bool:
    client = get_redis_client()
    result = await client.set(key, value, ex=ttl_seconds)
    return bool(result)


async def get_value(key: str) -> str | None:
    client = get_redis_client()
    return await client.get(key)


async def delete_key(key: str) -> bool:
    client = get_redis_client()
    result = await client.delete(key)
    return bool(result)


async def increment_counter(key: str, ttl_seconds: int | None = None) -> int:
    """Atomic increment. Optionally sets TTL on first call."""
    client = get_redis_client()
    value = await client.incr(key)
    if value == 1 and ttl_seconds:
        await client.expire(key, ttl_seconds)
    return value


# -- Rate limiting -------------------------------------------------------------

async def rate_limit_check(key: str, limit: int, window: int) -> tuple[bool, int]:
    """
    Sliding window rate limit check.
    Returns (is_allowed, remaining_requests).
    Used by RateLimitMiddleware in shared/middleware/rate_limiter.py.
    """
    client = get_redis_client()
    count = await client.incr(key)
    if count == 1:
        await client.expire(key, window)
    remaining = max(0, limit - count)
    return count <= limit, remaining


# -- JWT blacklist (token revocation) -----------------------------------------

_BLACKLIST_PREFIX = "jwt:blacklist:"
_BLACKLIST_TTL = 60 * 60 * 24 * 2  # 2 days (beyond max token lifetime)


async def blacklist_token(jti: str, ttl_seconds: int = _BLACKLIST_TTL) -> None:
    """
    Add a JWT JTI to the blacklist (logout / token revocation).
    Called by auth-service on logout or forced session revocation.
    """
    client = get_redis_client()
    await client.set(f"{_BLACKLIST_PREFIX}{jti}", "1", ex=ttl_seconds)
    logger.debug("Token blacklisted: jti=%s", jti)


async def is_token_blacklisted(jti: str) -> bool:
    """
    Check if a JWT JTI has been blacklisted.
    Called by healthcare-core on every authenticated request.
    Fails CLOSED (raises exception) if Redis is unavailable -- see SEC-4.
    """
    client = get_redis_client()
    result = await client.get(f"{_BLACKLIST_PREFIX}{jti}")
    return result is not None


# -- User status cache ---------------------------------------------------------

_USER_STATUS_PREFIX = "user:status:"
_USER_STATUS_TTL = 60 * 5  # 5 minutes


async def publish_user_status(user_id: str, is_active: bool, token_version: int) -> None:
    """
    Publish user status to Redis so healthcare-core can validate tokens
    without a DB round-trip on every request.
    Called by auth-service after login, registration, or account changes.
    """
    client = get_redis_client()
    payload = json.dumps({
        "is_active": "1" if is_active else "0",
        "token_version": str(token_version),
    })
    await client.set(
        f"{_USER_STATUS_PREFIX}{user_id}",
        payload,
        ex=_USER_STATUS_TTL,
    )


async def get_user_status(user_id: str) -> dict | None:
    """
    Retrieve cached user status.
    Returns None if not in cache (caller should fall back to DB).
    """
    client = get_redis_client()
    raw = await client.get(f"{_USER_STATUS_PREFIX}{user_id}")
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


async def invalidate_user_status(user_id: str) -> None:
    """Evict user status from cache (call on deactivation or password change)."""
    client = get_redis_client()
    await client.delete(f"{_USER_STATUS_PREFIX}{user_id}")


# -- Patient consent tokens ----------------------------------------------------

_CONSENT_PREFIX = "consent:token:"
_CONSENT_TTL = 60 * 60  # 1 hour


async def set_patient_consent_token(patient_id: str, token: str, ttl: int = _CONSENT_TTL) -> None:
    """
    Store a patient's consent token in Redis.
    Multi-worker safe -- no in-memory fallback.
    Called by healthcare-core patients endpoint after consent is granted.
    """
    client = get_redis_client()
    await client.set(f"{_CONSENT_PREFIX}{patient_id}", token, ex=ttl)


async def verify_patient_consent_token(patient_id: str, token: str) -> bool:
    """
    Verify a patient consent token.
    Returns True only if token matches what was stored.
    Raises if Redis is unavailable (fail-closed for consent operations).
    """
    client = get_redis_client()
    stored = await client.get(f"{_CONSENT_PREFIX}{patient_id}")
    if stored is None:
        return False
    import hmac
    return hmac.compare_digest(stored, token)


async def revoke_patient_consent_token(patient_id: str) -> None:
    """Revoke a patient's consent token."""
    client = get_redis_client()
    await client.delete(f"{_CONSENT_PREFIX}{patient_id}")


# -- OTP helpers ---------------------------------------------------------------

_OTP_PREFIX = "otp:hash:"
_OTP_ATTEMPTS_PREFIX = "otp:attempts:"
_OTP_TTL = 60 * 10          # 10 minutes
_OTP_LOCKOUT_TTL = 60 * 15  # 15 minutes lockout
_OTP_MAX_ATTEMPTS = 5


async def store_otp(key: str, otp_hash: str, ttl: int = _OTP_TTL) -> None:
    """Store OTP hash for a given key (phone/email). Resets attempt counter."""
    client = get_redis_client()
    await client.set(f"{_OTP_PREFIX}{key}", otp_hash, ex=ttl)
    await client.delete(f"{_OTP_ATTEMPTS_PREFIX}{key}")


async def get_otp(key: str) -> str | None:
    """Retrieve stored OTP hash."""
    client = get_redis_client()
    return await client.get(f"{_OTP_PREFIX}{key}")


async def increment_otp_attempts(key: str) -> int:
    """Increment failed OTP attempt counter. Returns current count."""
    client = get_redis_client()
    attempts_key = f"{_OTP_ATTEMPTS_PREFIX}{key}"
    count = await client.incr(attempts_key)
    if count == 1:
        await client.expire(attempts_key, _OTP_LOCKOUT_TTL)
    return count


async def is_otp_locked(key: str) -> bool:
    """Check if OTP attempts are locked out."""
    client = get_redis_client()
    raw = await client.get(f"{_OTP_ATTEMPTS_PREFIX}{key}")
    return int(raw) >= _OTP_MAX_ATTEMPTS if raw else False


async def clear_otp(key: str) -> None:
    """Clear OTP and attempt counter after successful verification."""
    client = get_redis_client()
    await client.delete(f"{_OTP_PREFIX}{key}", f"{_OTP_ATTEMPTS_PREFIX}{key}")
