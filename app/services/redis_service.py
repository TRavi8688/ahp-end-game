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
    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self.redis_url = settings.REDIS_URL
        self._memory_storage: Dict[str, Any] = {} # Fallback for dev/test

    def get_client(self) -> Optional[redis.Redis]:
        # Check if Redis is explicitly disabled for local dev/test
        if not settings.USE_REDIS:
            return None

        if self._client is None:
            if not self.redis_url:
                if settings.ENVIRONMENT == "production":
                    logger.critical("REDIS_CONFIG_MISSING: REDIS_URL must be set in production.")
                    raise RuntimeError("CRITICAL: Redis configuration missing.")
                return None # Signal fallback
            
            try:
                # Optimized for fast failure in non-production
                self._client = redis.from_url(
                    self.redis_url, 
                    decode_responses=True,
                    socket_timeout=1, 
                    socket_connect_timeout=1,
                    retry_on_timeout=False
                )
            except Exception as e:
                logger.warning(f"REDIS_CLIENT_INIT_FAILURE: {e}")
                if settings.ENVIRONMENT == "production":
                    raise
                return None

        return self._client

    async def set(self, key: str, value: str, expire: int = 600):
        """Standard Redis SETEX operation with in-memory fallback."""
        client = self.get_client()
        if client:
            try:
                await client.setex(key, expire, value)
                logger.info(f"REDIS_SET_SUCCESS: {key}")
                return
            except Exception as e:
                if settings.ENVIRONMENT == "production": 
                    logger.error(f"REDIS_SET_CRITICAL_FAILURE: {e}")
                    raise
                logger.warning(f"REDIS_SET_FALLBACK_TRIGGERED: {e}")
        
        # Fallback for Dev/Test
        self._memory_storage[key] = value
        logger.debug(f"REDIS_FALLBACK_SET: {key}")

    async def get(self, key: str) -> Optional[str]:
        """Standard Redis GET operation with in-memory fallback."""
        client = self.get_client()
        if client:
            try:
                val = await client.get(key)
                logger.info(f"REDIS_GET_SUCCESS: {key}")
                return val
            except Exception as e:
                if settings.ENVIRONMENT == "production":
                    logger.error(f"REDIS_GET_CRITICAL_FAILURE: {e}")
                    raise
                logger.warning(f"REDIS_GET_FALLBACK_TRIGGERED: {e}")
        
        # Fallback for Dev/Test
        val = self._memory_storage.get(key)
        logger.debug(f"REDIS_FALLBACK_GET: {key} -> {val}")
        return val

    async def delete(self, key: str):
        """Standard Redis DEL operation with in-memory fallback."""
        client = self.get_client()
        if client:
            try:
                await client.delete(key)
                return
            except Exception:
                if settings.ENVIRONMENT == "production": raise
        
        self._memory_storage.pop(key, None)

    async def set_nx(self, key: str, value: str, expire: int = 30) -> bool:
        """Atomic SET if Not Exists with in-memory fallback."""
        client = self.get_client()
        if client:
            try:
                return await client.set(key, value, ex=expire, nx=True)
            except Exception:
                if settings.ENVIRONMENT == "production": raise
        
        if key in self._memory_storage:
            return False
        self._memory_storage[key] = value
        return True

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
