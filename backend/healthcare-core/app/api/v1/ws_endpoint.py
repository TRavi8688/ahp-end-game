# backend/healthcare-core/app/api/v1/ws_endpoint.py
# SEC-8 FIX: Add JWT authentication and Redis-based rate limiting to WebSocket.

import logging
from collections import defaultdict
from datetime import datetime, timedelta

import redis as redis_lib
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

# Re-use the same JWT verification utility used in REST routes
from app.core.security import verify_token  # adjust import path as needed

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Rate-limiting constants
# ---------------------------------------------------------------------------
WS_MAX_CONNECTIONS_PER_IP_PER_MINUTE = 10
WS_MAX_CONCURRENT_PER_USER = 5

# In-memory tracker for concurrent connections per user (supplement Redis rate limit)
_user_connection_count: dict[str, int] = defaultdict(int)


def _get_client_ip(websocket: WebSocket) -> str:
    forwarded_for = websocket.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return websocket.client.host if websocket.client else "unknown"


def _check_rate_limit(redis_client: redis_lib.Redis, ip: str) -> bool:
    """
    Returns True (allowed) if IP has fewer than WS_MAX_CONNECTIONS_PER_IP_PER_MINUTE
    in the current 60-second window. Uses a Redis sliding counter.
    """
    key = f"ws:ratelimit:{ip}:{datetime.utcnow().strftime('%Y%m%d%H%M')}"
    try:
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, 60)
        return count <= WS_MAX_CONNECTIONS_PER_IP_PER_MINUTE
    except redis_lib.RedisError:
        # Fail-closed for rate limiting too — deny if Redis is down
        logger.error("Redis unavailable for WS rate limit check — denying connection")
        return False


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None):
    """
    SEC-8 FIX:
      1. Reject connections missing or with invalid JWT (code 1008 Policy Violation).
      2. Rate-limit new connections: max 10/min per IP via Redis.
      3. Limit concurrent connections per user.
    Token is passed as query param: ws://host/ws?token=<jwt>
    """
    client_ip = _get_client_ip(websocket)

    # --- 1. JWT validation ---
    if not token:
        logger.warning("WS connection rejected: no token from %s", client_ip)
        await websocket.close(code=1008)  # 1008 = Policy Violation
        return

    payload = verify_token(token)  # raises or returns None on invalid
    if not payload:
        logger.warning("WS connection rejected: invalid token from %s", client_ip)
        await websocket.close(code=1008)
        return

    user_id: str = payload.get("sub")
    if not user_id:
        await websocket.close(code=1008)
        return

    # --- 2. IP rate limit ---
    redis_client = websocket.app.state.redis  # assumes redis attached to app.state
    if not _check_rate_limit(redis_client, client_ip):
        logger.warning("WS rate limit exceeded for IP %s", client_ip)
        await websocket.close(code=1008)
        return

    # --- 3. Max concurrent connections per user ---
    if _user_connection_count[user_id] >= WS_MAX_CONCURRENT_PER_USER:
        logger.warning("WS max concurrent connections reached for user %s", user_id)
        await websocket.close(code=1008)
        return

    await websocket.accept()
    _user_connection_count[user_id] += 1
    logger.info("WS connection accepted: user=%s ip=%s", user_id, client_ip)

    try:
        while True:
            data = await websocket.receive_text()
            # ... existing message handling logic ...
            await websocket.send_text(f"echo: {data}")
    except WebSocketDisconnect:
        logger.info("WS disconnected: user=%s", user_id)
    finally:
        _user_connection_count[user_id] = max(0, _user_connection_count[user_id] - 1)
