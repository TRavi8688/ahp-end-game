import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    Manages active WebSocket connections for real-time queue updates.
    Scoped by hospital_id to avoid cross-hospital leakage.
    """
    def __init__(self):
        # hospital_id -> Set of WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, hospital_id: str, websocket: WebSocket):
        await websocket.accept()
        if hospital_id not in self.active_connections:
            self.active_connections[hospital_id] = set()
        self.active_connections[hospital_id].add(websocket)
        logger.info(f"WebSocket connected for hospital: {hospital_id}. Total connections: {len(self.active_connections[hospital_id])}")

    def disconnect(self, hospital_id: str, websocket: WebSocket):
        if hospital_id in self.active_connections:
            if websocket in self.active_connections[hospital_id]:
                self.active_connections[hospital_id].remove(websocket)
                logger.info(f"WebSocket disconnected for hospital: {hospital_id}. Remaining: {len(self.active_connections[hospital_id])}")
            if not self.active_connections[hospital_id]:
                del self.active_connections[hospital_id]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_hospital(self, hospital_id: str, event_type: str, data: dict):
        """
        Broadcasts an event payload to all active connections for a specific hospital.
        """
        if hospital_id not in self.active_connections:
            return

        payload = {
            "event": event_type,
            "data": data
        }
        
        # Make a copy of connections to avoid modification issues during iteration
        targets = list(self.active_connections[hospital_id])
        for connection in targets:
            try:
                await connection.send_json(payload)
            except Exception as e:
                logger.warning(f"Failed to send WS message, disconnecting client: {e}")
                self.disconnect(hospital_id, connection)

manager = ConnectionManager()
