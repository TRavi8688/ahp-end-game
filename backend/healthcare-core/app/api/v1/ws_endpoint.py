import logging
from collections import defaultdict
from datetime import datetime
import redis as redis_lib
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.websockets import manager
from app.core.security import _decode_token
from app.services.queue_service import resolve_any_staff
from app.core.database import get_session_factory

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate-limiting constants
# ---------------------------------------------------------------------------
WS_MAX_CONNECTIONS_PER_IP_PER_MINUTE = 10
WS_MAX_CONCURRENT_PER_USER = 5

_user_connection_count: dict[str, int] = defaultdict(int)

def _get_client_ip(websocket: WebSocket) -> str:
    forwarded_for = websocket.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return websocket.client.host if websocket.client else "unknown"

def _check_rate_limit(redis_client: redis_lib.Redis, ip: str) -> bool:
    key = f"ws:ratelimit:{ip}:{datetime.utcnow().strftime('%Y%m%d%H%M')}"
    try:
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, 60)
        return count <= WS_MAX_CONNECTIONS_PER_IP_PER_MINUTE
    except redis_lib.RedisError:
        logger.error("Redis unavailable for WS rate limit check -- denying connection")
        return False

@router.websocket("/ws/reception")
async def websocket_reception(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time reception dashboard updates.
    Expects JWT token in query parameters for security verification.
    """
    client_ip = _get_client_ip(websocket)

    try:
        payload = await _decode_token(token)
    except Exception as e:
        logger.warning(f"WebSocket authentication failed: {e}")
        await websocket.close(code=1008)  # Policy Violation
        return

    user_id = payload.sub

    # Rate limiting
    try:
        # Assuming redis is attached to app.state
        redis_client = websocket.app.state.redis
        if not _check_rate_limit(redis_client, client_ip):
            logger.warning("WS rate limit exceeded for IP %s", client_ip)
            await websocket.close(code=1008)
            return
    except Exception:
        # If redis isn't attached or fails
        logger.warning("Redis not available for WS rate limiting")
        pass

    if _user_connection_count[user_id] >= WS_MAX_CONCURRENT_PER_USER:
        logger.warning("WS max concurrent connections reached for user %s", user_id)
        await websocket.close(code=1008)
        return

    session_factory = get_session_factory()
    async with session_factory() as db:
        staff = await resolve_any_staff(db, user_id)
        if not staff:
            logger.warning(
                f"WebSocket auth failed: User {user_id} is not registered staff."
            )
            await websocket.close(code=1008)
            return
        hospital_id = str(staff.hospital_id)

    await manager.connect(hospital_id, websocket)
    _user_connection_count[user_id] += 1

    try:
        while True:
            # Maintain connection and listen for client messages (e.g. ping)
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"event": "pong", "data": {}})
    except WebSocketDisconnect:
        manager.disconnect(hospital_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        manager.disconnect(hospital_id, websocket)
    finally:
        _user_connection_count[user_id] = max(0, _user_connection_count[user_id] - 1)
