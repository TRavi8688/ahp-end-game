import asyncio
import time
from enum import Enum
from typing import Callable, Any, Optional
from app.core.logging import logger
from app.services.redis_service import redis_service
from app.core.metrics import CIRCUIT_BREAKER_STATE

class CircuitState(Enum):
    CLOSED = 0
    OPEN = 1
    HALF_OPEN = 2

class DistributedCircuitBreaker:
    """
    Redis-backed Circuit Breaker for high-availability healthcare systems.
    Prevents cascading failures when external providers (AI, SMS, Cloud Storage) are down.
    """
    def __init__(
        self, 
        name: str, 
        failure_threshold: int = 5, 
        recovery_timeout: int = 60,
        half_open_max_calls: int = 3
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.fail_key = f"cb:{name}:fails"
        self.state_key = f"cb:{name}:state"
        self.last_failure_key = f"cb:{name}:last_fail"

    async def is_available(self) -> bool:
        """Check if the circuit is available (Closed or Half-Open)."""
        state = await self.get_state()
        if state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            last_fail = await redis_service.get(self.last_failure_key)
            if last_fail and (time.time() - float(last_fail)) > self.recovery_timeout:
                return True # Allow a probe (Half-Open)
            return False
        return True

    async def get_state(self) -> CircuitState:
        state = await redis_service.get(self.state_key)
        if not state:
            return CircuitState.CLOSED
        return CircuitState(int(state))

    async def _set_state(self, state: CircuitState):
        await redis_service.set(self.state_key, str(state.value), expire=self.recovery_timeout * 2)
        CIRCUIT_BREAKER_STATE.labels(provider=self.name).set(state.value)

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        state = await self.get_state()

        if state == CircuitState.OPEN:
            last_fail = await redis_service.get(self.last_failure_key)
            if last_fail and (time.time() - float(last_fail)) > self.recovery_timeout:
                logger.info(f"CIRCUIT_BREAKER: {self.name} entering HALF_OPEN state.")
                await self._set_state(CircuitState.HALF_OPEN)
                state = CircuitState.HALF_OPEN
            else:
                logger.warning(f"CIRCUIT_BREAKER: {self.name} is OPEN. Fast-failing request.")
                raise Exception(f"Circuit breaker {self.name} is open")

        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure(e)
            raise e

    async def _on_success(self):
        state = await self.get_state()
        if state == CircuitState.HALF_OPEN:
            # In a real system, we'd count successful calls in half-open
            # For simplicity, first success closes it
            logger.info(f"CIRCUIT_BREAKER: {self.name} recovered. Closing circuit.")
            await self._set_state(CircuitState.CLOSED)
            await redis_service.delete(self.fail_key)
        elif state == CircuitState.CLOSED:
            await redis_service.delete(self.fail_key)

    async def _on_failure(self, error: Exception):
        fails = await redis_service.incr(self.fail_key)
        await redis_service.set(self.last_failure_key, str(time.time()), expire=self.recovery_timeout)
        
        if fails >= self.failure_threshold:
            logger.critical(f"CIRCUIT_BREAKER: {self.name} TRIPPED! Threshold {self.failure_threshold} reached. Error: {error}")
            await self._set_state(CircuitState.OPEN)

async def with_retry(
    func: Callable, 
    retries: int = 3, 
    backoff: float = 1.0, 
    exceptions=(Exception,)
):
    """Exponential backoff retry orchestration."""
    for i in range(retries):
        try:
            return await func()
        except exceptions as e:
            if i == retries - 1:
                raise e
            wait = backoff * (2 ** i)
            logger.warning(f"RETRY: Attempt {i+1} failed. Waiting {wait}s. Error: {e}")
            await asyncio.sleep(wait)
