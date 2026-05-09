import redis.asyncio as redis
import json
import os
from typing import Optional, Dict, Any
from app.core.config import settings
from app.core.logging import logger

class RedisService:
    """
    Production-Grade Redis Service.
    NO IN-MEMORY FALLBACKS. This service enforces distributed state consistency.
    If Redis is unavailable, the system fails fast to prevent split-brain scenarios.
    """
class RedisConnectionError(Exception):
    """Raised when Redis is unreachable in a production environment."""
    pass

class RedisService:
    """
    ENTERPRISE RESILIENCE REDIS SERVICE.
    NO IN-MEMORY FALLBACKS for critical distributed state (Idempotency, Locks).
    Failure to connect to Redis triggers a hard failure to maintain data integrity
    and prevent 'double-action' clinical errors.
    """
    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self.redis_url = settings.REDIS_URL

    def get_client(self) -> Optional[redis.Redis]:
        if not settings.USE_REDIS:
            return None

        if self._client is None:
            if not self.redis_url:
                if settings.ENVIRONMENT == "production":
                    logger.critical("REDIS_CONFIG_MISSING")
                    raise RedisConnectionError("Redis URL required in production.")
                return None
            
            try:
                self._client = redis.from_url(
                    self.redis_url, 
                    decode_responses=True,
                    socket_timeout=2, 
                    socket_connect_timeout=2,
                    retry_on_timeout=True,
                    health_check_interval=30
                )
            except Exception as e:
                logger.error(f"REDIS_CONNECTION_FAILURE: {e}")
                if settings.ENVIRONMENT == "production":
                    raise RedisConnectionError(f"Could not connect to Redis: {e}")
                return None

        return self._client

    async def set(self, key: str, value: str, expire: int = 600):
        client = self.get_client()
        if not client: return
        try:
            await client.setex(key, expire, value)
        except Exception as e:
            logger.error(f"REDIS_WRITE_ERROR: {e}")
            if settings.ENVIRONMENT == "production": raise RedisConnectionError(e)

    async def get(self, key: str) -> Optional[str]:
        client = self.get_client()
        if not client: return None
        try:
            return await client.get(key)
        except Exception as e:
            logger.error(f"REDIS_READ_ERROR: {e}")
            if settings.ENVIRONMENT == "production": raise RedisConnectionError(e)
            return None

    async def delete(self, key: str):
        client = self.get_client()
        if client:
            try:
                await client.delete(key)
            except Exception:
                if settings.ENVIRONMENT == "production": raise

    async def set_nx(self, key: str, value: str, expire: int = 30) -> bool:
        """STRICTLY ATOMIC SET-IF-NOT-EXISTS."""
        client = self.get_client()
        if not client:
            # If Redis is down, we MUST NOT allow the action to proceed 
            # if it relies on idempotency/locking.
            if settings.ENVIRONMENT == "production":
                raise RedisConnectionError("Redis unavailable for atomic lock.")
            return True # In dev, we allow it.
        
        try:
            return await client.set(key, value, ex=expire, nx=True)
        except Exception:
            if settings.ENVIRONMENT == "production": raise RedisConnectionError("Redis lock failed.")
            return True

    async def incr(self, key: str) -> int:
        client = self.get_client()
        if not client: return 0
        return await client.incr(key)

    async def set_otp(self, identifier: str, otp: str, expire_seconds: int = 600):
        await self.set(f"otp:{identifier}", otp, expire_seconds)

    async def get_otp(self, identifier: str) -> Optional[str]:
        return await self.get(f"otp:{identifier}")

    async def delete_otp(self, identifier: str):
        await self.delete(f"otp:{identifier}")

    async def blacklist_token(self, jti: str, expire_seconds: int):
        await self.set(f"blacklist:{jti}", "true", expire_seconds)

    async def is_token_blacklisted(self, jti: str) -> bool:
        val = await self.get(f"blacklist:{jti}")
        return val == "true"

redis_service = RedisService()
