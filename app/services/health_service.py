import time
from typing import Dict
from app.services.redis_service import redis_service
from app.core.database import get_writer_engine
from app.core.logging import logger
from sqlalchemy import text

class LoadSheddingService:
    """
    Hospyn Resilience Shield: Load-Shedding & Priority Degradation.
    Monitors infrastructure latency to protect core clinical workflows.
    """
    def __init__(self):
        self.LATENCY_THRESHOLD_MS = 500  # Threshold to trigger load shedding
        self._last_check = 0
        self._is_under_load = False

    async def check_system_health(self) -> bool:
        """
        Check DB and Redis latency. Returns True if system is overloaded.
        """
        # Rate limit health checks to once every 5 seconds
        if time.time() - self._last_check < 5:
            return self._is_under_load

        try:
            # 1. Check DB Latency
            start = time.time()
            engine = get_writer_engine()
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_latency = (time.time() - start) * 1000

            # 2. Check Redis Latency
            start = time.time()
            await redis_service.get("health_ping")
            redis_latency = (time.time() - start) * 1000

            self._is_under_load = (db_latency > self.LATENCY_THRESHOLD_MS or 
                                  redis_latency > self.LATENCY_THRESHOLD_MS)
            
            if self._is_under_load:
                logger.warning(f"SYSTEM_OVERLOAD_DETECTED: DB={db_latency:.2f}ms, Redis={redis_latency:.2f}ms")
            
            self._last_check = time.time()
            return self._is_under_load
            
        except Exception as e:
            logger.error(f"HEALTH_CHECK_FAILURE: {e}")
            self._is_under_load = True # Fail-Safe: Assume load if check fails
            return True

    async def should_shed_load(self, priority: str = "P3") -> bool:
        """
        Determines if a feature should be disabled based on its priority.
        P0 = Critical (Never shed)
        P1 = High (Shed only if critical failure)
        P2 = Normal (Shed during heavy load)
        P3 = Low (Shed immediately on latency spike)
        """
        is_loaded = await self.check_system_health()
        if not is_loaded:
            return False

        if priority == "P0": return False
        if priority == "P1": return False # Preserve P1 for now
        if priority == "P2" or priority == "P3":
            return True
        
        return False

system_health = LoadSheddingService()
