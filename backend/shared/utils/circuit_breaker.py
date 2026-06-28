"""
shared/utils/circuit_breaker.py

Redis-backed Circuit Breaker for HTTP calls.

FIXES:
  - Wrong import: `from backend.shared.redis_client` -> `from shared.redis_client`
  - Wrong function name: `get_redis()` -> `get_redis_client()`
  - In-memory state (broken on Cloud Run horizontal scaling) ->
    state now stored in Redis so all instances share one view.

PLACE AT: backend/shared/utils/circuit_breaker.py
"""
from __future__ import annotations

import json
import logging
import time
from typing import Callable, Any

import httpx

from shared.redis_client import get_redis_client

logger = logging.getLogger(__name__)


class CircuitBreakerOpenException(Exception):
    pass


class CircuitBreaker:
    """
    Redis-backed Circuit Breaker for HTTP calls.

    State is stored in Redis so all Cloud Run instances share
    the same circuit state -- fixes the in-memory isolation bug.

    States: CLOSED -> OPEN -> HALF-OPEN -> CLOSED

    Args:
        name:               Unique name (used as Redis key prefix).
        failure_threshold:  Consecutive failures before opening.
        recovery_timeout:   Seconds to wait in OPEN before trying again.
        cache_ttl:          Seconds to cache GET responses for fallback.
    """

    _STATE_KEY   = "cb:state:{name}"
    _FAILURES_KEY = "cb:failures:{name}"
    _CACHE_KEY   = "cb:cache:{name}:{url}"

    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        recovery_timeout: int = 30,
        cache_ttl: int = 3600,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.cache_ttl = cache_ttl

    # -- Redis key helpers -----------------------------------------------------

    def _state_key(self) -> str:
        return f"cb:state:{self.name}"

    def _failures_key(self) -> str:
        return f"cb:failures:{self.name}"

    def _cache_key(self, url: str) -> str:
        return f"cb:cache:{self.name}:{url}"

    # -- State accessors (Redis-backed) ----------------------------------------

    async def _get_state(self) -> dict:
        """Return {'state': str, 'opened_at': float}. Defaults to CLOSED."""
        try:
            redis = get_redis_client()
            raw = await redis.get(self._state_key())
            if raw:
                return json.loads(raw)
        except Exception as e:
            logger.warning("CircuitBreaker._get_state failed: %s", e)
        return {"state": "CLOSED", "opened_at": 0.0}

    async def _set_state(self, state: str) -> None:
        try:
            redis = get_redis_client()
            payload = json.dumps({"state": state, "opened_at": time.time()})
            # Keep state for recovery_timeout * 4 to allow HALF-OPEN window
            await redis.set(self._state_key(), payload, ex=self.recovery_timeout * 4)
        except Exception as e:
            logger.warning("CircuitBreaker._set_state failed: %s", e)

    async def _increment_failures(self) -> int:
        try:
            redis = get_redis_client()
            count = await redis.incr(self._failures_key())
            if count == 1:
                # First failure -- start TTL window
                await redis.expire(self._failures_key(), self.recovery_timeout * 2)
            return count
        except Exception as e:
            logger.warning("CircuitBreaker._increment_failures failed: %s", e)
            return 1

    async def _reset_failures(self) -> None:
        try:
            redis = get_redis_client()
            await redis.delete(self._failures_key())
        except Exception as e:
            logger.warning("CircuitBreaker._reset_failures failed: %s", e)

    # -- Main call -------------------------------------------------------------

    async def call(
        self,
        func: Callable,
        request: httpx.Request,
        *args: Any,
        **kwargs: Any,
    ) -> httpx.Response:
        state_data = await self._get_state()
        state = state_data["state"]
        opened_at = state_data.get("opened_at", 0.0)

        if state == "OPEN":
            if time.time() - opened_at >= self.recovery_timeout:
                logger.info("CircuitBreaker '%s' entering HALF-OPEN", self.name)
                await self._set_state("HALF-OPEN")
                state = "HALF-OPEN"
            else:
                return await self._handle_fallback(request)

        try:
            response = await func(*args, **kwargs)
            response.raise_for_status()

            if state == "HALF-OPEN":
                logger.info("CircuitBreaker '%s' CLOSED after successful probe", self.name)
                await self._set_state("CLOSED")
                await self._reset_failures()

            # Cache successful GET responses for fallback
            if request.method.upper() == "GET":
                try:
                    redis = get_redis_client()
                    await redis.set(
                        self._cache_key(str(request.url)),
                        response.content,
                        ex=self.cache_ttl,
                    )
                except Exception as e:
                    logger.warning("CircuitBreaker cache write failed: %s", e)

            return response

        except Exception as e:
            failures = await self._increment_failures()
            logger.warning(
                "CircuitBreaker '%s' failure %d/%d: %s",
                self.name, failures, self.failure_threshold, e,
            )

            if state == "HALF-OPEN" or failures >= self.failure_threshold:
                logger.error("CircuitBreaker '%s' OPENED", self.name)
                await self._set_state("OPEN")
                return await self._handle_fallback(request)

            raise

    # -- Fallback --------------------------------------------------------------

    async def _handle_fallback(self, request: httpx.Request) -> httpx.Response:
        """Serve stale cache for GETs; return 503 for writes."""
        if request.method.upper() == "GET":
            try:
                redis = get_redis_client()
                cached = await redis.get(self._cache_key(str(request.url)))
                if cached:
                    logger.info(
                        "CircuitBreaker '%s' serving stale cache for %s",
                        self.name, request.url,
                    )
                    return httpx.Response(
                        status_code=200,
                        content=cached if isinstance(cached, bytes) else cached.encode(),
                        headers={"X-Circuit-Breaker-Fallback": "true"},
                    )
            except Exception as e:
                logger.warning("CircuitBreaker cache read failed: %s", e)

        return httpx.Response(
            status_code=503,
            content=json.dumps({
                "error": "Service temporarily unavailable",
                "circuit_breaker": "OPEN",
                "service": self.name,
            }).encode(),
            headers={"Content-Type": "application/json"},
        )
