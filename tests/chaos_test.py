import asyncio
import pytest
from app.core.reliability import DistributedCircuitBreaker, CircuitState
from app.services.redis_service import redis_service
from app.core.logging import logger

@pytest.mark.asyncio
async def test_circuit_breaker_trip_and_recovery():
    """
    CHAOS SIMULATION:
    1. Force multiple failures to trip the circuit.
    2. Verify circuit enters OPEN state and blocks requests.
    3. Wait for recovery timeout.
    4. Verify circuit enters HALF_OPEN and recovers on success.
    """
    cb = DistributedCircuitBreaker("test_provider", failure_threshold=2, recovery_timeout=2)
    
    # Ensure clean state
    await redis_service.delete(cb.fail_key)
    await redis_service.delete(cb.state_key)
    
    async def failing_func():
        raise Exception("Provider Down")

    async def successful_func():
        return "Success"

    # 1. Trip the circuit
    logger.info("CHAOS: Simulating provider failure...")
    for _ in range(2):
        with pytest.raises(Exception):
            await cb.call(failing_func)
    
    assert await cb.get_state() == CircuitState.OPEN
    
    # 2. Verify blocking
    logger.info("CHAOS: Verifying circuit is OPEN and blocking...")
    with pytest.raises(Exception) as exc:
        await cb.call(successful_func)
    assert "is open" in str(exc.value)

    # 3. Wait for recovery
    logger.info("CHAOS: Waiting for recovery timeout...")
    await asyncio.sleep(2.1)
    
    # 4. Recover
    logger.info("CHAOS: Simulating recovery (HALF_OPEN -> CLOSED)...")
    result = await cb.call(successful_func)
    assert result == "Success"
    assert await cb.get_state() == CircuitState.CLOSED

@pytest.mark.asyncio
async def test_tenant_isolation_chaos():
    """
    CHAOS SIMULATION:
    Attempt to access tenant B data using tenant A credentials 
    under high-concurrency pressure to check for leakages.
    """
    # This would involve calling API endpoints with mismatched UUIDs
    # and verifying the 403 response persists even during 'thundering herd'
    pass
