# backend/healthcare-core/app/core/security.py  (relevant excerpt)
# SEC-4 FIX: Change Redis blacklist from fail-open to fail-CLOSED.
#
# SECURITY DECISION (documented per audit requirement):
# If Redis is unreachable we CANNOT verify whether a token has been revoked.
# A fail-open policy means revoked tokens (e.g. from compromised sessions)
# continue to work, defeating the entire purpose of the blacklist.
# We therefore treat Redis unavailability as a hard authentication failure
# and return HTTP 503 rather than silently permitting the request.

import logging
from fastapi import HTTPException, status
import redis as redis_lib

logger = logging.getLogger(__name__)


def is_token_blacklisted(token_jti: str, redis_client: redis_lib.Redis) -> bool:
    """
    Returns True if the token JTI is in the Redis blacklist.

    Raises HTTP 503 if Redis is unreachable (fail-CLOSED — see security decision above).
    """
    try:
        result = redis_client.get(f"blacklist:{token_jti}")
        return result is not None
    except (redis_lib.RedisError, Exception) as exc:
        # SEC-4 FIX: was `logger.warning(...); return False` — fail-open.
        # Now: fail-CLOSED — reject the request so revoked tokens cannot slip through.
        logger.error(
            "Redis blacklist unavailable — rejecting authentication request. "
            "Original error: %s", exc
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable. Please try again shortly.",
        )


# ---------------------------------------------------------------------------
# Add Redis to /health endpoint
# ---------------------------------------------------------------------------
# In your health-check route (e.g. app/api/v1/health.py), add:

def check_redis_health(redis_client: redis_lib.Redis) -> dict:
    """Returns Redis connectivity status for the /health endpoint."""
    try:
        redis_client.ping()
        return {"status": "ok"}
    except redis_lib.RedisError as exc:
        return {"status": "unavailable", "error": str(exc)}
