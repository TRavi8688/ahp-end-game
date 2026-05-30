import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.websockets import manager
from app.core.security import _decode_token
from app.services.queue_service import resolve_any_staff
from app.core.database import get_session_factory

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/reception")
async def websocket_reception(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time reception dashboard updates.
    Expects JWT token in query parameters for security verification.
    """
    try:
        payload = await _decode_token(token)
    except Exception as e:
        logger.warning(f"WebSocket authentication failed: {e}")
        await websocket.close(code=1008)  # Policy Violation
        return

    session_factory = get_session_factory()
    async with session_factory() as db:
        staff = await resolve_any_staff(db, payload.sub)
        if not staff:
            logger.warning(
                f"WebSocket auth failed: User {payload.sub} is not registered staff."
            )
            await websocket.close(code=1008)
            return
        hospital_id = str(staff.hospital_id)

    await manager.connect(hospital_id, websocket)
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
