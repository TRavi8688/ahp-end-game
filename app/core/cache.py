import json
import asyncio
from typing import Any, Optional, Union
import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool
from redis.exceptions import ConnectionError, TimeoutError, BusyLoadingError
from app.core.config import settings
from app.core.logging import logger

class CacheService:
    def __init__(self):
        self.redis_url = settings.REDIS_URL
        self._pool: Optional[ConnectionPool] = None
        self._redis: Optional[redis.Redis] = None

    def _get_pool(self) -> ConnectionPool:
        if self._pool is None:
            self._pool = ConnectionPool.from_url(
                self.redis_url,
                max_connections=50,
                decode_responses=True
            )
        return self._pool

    async def get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.Redis(connection_pool=self._get_pool())
        return self._redis

    async def _execute_with_retry(self, func, *args, **kwargs) -> Any:
        """Execute Redis command with fail-fast retry logic."""
        max_retries = 3 # Reduced from 5
        base_delay = 0.2
        for attempt in range(max_retries):
            try:
                r = await self.get_redis()
                return await func(r, *args, **kwargs)
            except (ConnectionError, TimeoutError, BusyLoadingError) as e:
                if attempt == max_retries - 1:
                    logger.error(f"REDIS_FATAL: Operation failed after {max_retries} attempts: {e}")
                    raise
                
                delay = base_delay * (2 ** attempt)
                logger.warning(f"REDIS_RETRY: Attempt {attempt + 1} failed. Quick retry in {delay}s...")
                await asyncio.sleep(delay)
                self._redis = None 
            except Exception as e:
                logger.error(f"REDIS_ERROR: Unhandled exception: {e}")
                raise

    async def get(self, key: str) -> Optional[Any]:
        try:
            async def _get(r):
                data = await r.get(key)
                return json.loads(data) if data else None
            return await self._execute_with_retry(_get)
        except Exception:
            return None

    async def set(self, key: str, value: Any, expire: int = 3600) -> bool:
        try:
            async def _set(r):
                await r.set(key, json.dumps(value), ex=expire)
                return True
            return await self._execute_with_retry(_set)
        except Exception:
            return False

    async def delete(self, key: str) -> bool:
        try:
            async def _delete(r):
                await r.delete(key)
                return True
            return await self._execute_with_retry(_delete)
        except Exception:
            return False

    async def is_healthy(self) -> bool:
        """Health check for Redis connectivity."""
        try:
            r = await self.get_redis()
            await r.ping()
            return True
        except Exception:
            return False

    async def close(self):
        if self._redis:
            await self._redis.close()
        if self._pool:
            await self._pool.disconnect()

cache = CacheService()
