from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import settings
from app.core.logging import logger
import os

# --- ENTERPRISE DISTRIBUTED RATE LIMITING ---
# Moving window strategy prevents 'edge bursts' allowed by fixed windows.
# Redis is ABSOLUTELY MANDATORY in production to prevent split-brain limits across pods.

env = os.environ.get("ENVIRONMENT", "production").lower()
storage_uri = settings.REDIS_URL

if not settings.USE_REDIS or not storage_uri or storage_uri.startswith("memory://"):
    if env == "production":
        # Google-grade engineering: Fail fast on unsafe configurations
        logger.critical("PRODUCTION_RATE_LIMITER_FAILURE: Redis is mandatory for distributed rate limiting.")
        raise RuntimeError("CRITICAL: Redis is mandatory for distributed rate limiting in production.")
    else:
        # Development fallback allowed only if ENVIRONMENT is NOT production
        storage_uri = "memory://"

async def check_ip_blacklist(ip: str) -> bool:
    """Enterprise Breach Containment: Blocks suspicious IPs in Redis."""
    from app.services.redis_service import redis_service
    try:
        is_blocked = await redis_service.get(f"blacklist:{ip}")
        return bool(is_blocked)
    except Exception:
        # Fail-fast: Only block on failure if in PRODUCTION
        if settings.ENVIRONMENT == "production":
            return True
        return False

async def blacklist_ip(ip: str, duration: int = 3600):
    """Automatically blacklists an IP after excessive violations."""
    from app.services.redis_service import redis_service
    await redis_service.set(f"blacklist:{ip}", "BLOCKED", expire=duration)
    logger.warning("IP_BLACKLISTED", ip=ip, duration=duration)

# Global Rate Limiter Instance
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=storage_uri,
    strategy="moving-window",
    default_limits=["1000 per day", "200 per hour"]
)
