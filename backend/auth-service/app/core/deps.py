"""
auth-service/app/core/deps.py

PLACE AT: backend/auth-service/app/core/deps.py
FIX: app/api/v1/auth.py line 17 imports get_redis from here.
     File was missing — try/except in auth.py swallowed the ImportError
     and silently disabled OTP rate limiting in production.
"""
from __future__ import annotations

import logging
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import HTTPException, status

from app.config.settings import settings

logger = logging.getLogger(__name__)

_redis_pool: aioredis.Redis | None = None


def _get_pool() -> aioredis.Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
        )
        logger.info("Redis connection pool created")
    return _redis_pool


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """
    FastAPI dependency — yields a Redis client.
    Raises HTTP 503 if Redis is unreachable so callers know
    rate-limiting is unavailable. Never silently skips it.
    """
    try:
        client = _get_pool()
        yield client
    except Exception as exc:
        logger.error("Redis connection error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cache service temporarily unavailable. Please retry.",
        )
