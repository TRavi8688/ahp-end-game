import json
import asyncio
from enum import Enum
from typing import Dict, Set, List, Optional, Any, Union
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import uuid
from app.core.logging import logger
from app.services.redis_service import redis_service

class MessageType(str, Enum):
    NEW_RECORD = "new_record"
    ANALYSIS_COMPLETE = "analysis_complete"
    DASHBOARD_UPDATE = "dashboard_update"
    CHAT_MESSAGE = "chat_message"
    CONSULTATION_START = "consultation_start"
    CONSENT_REQUEST = "consent_request"
    BED_STATUS_UPDATE = "bed_status_update"

class RealtimeMessage(BaseModel):
    type: Union[MessageType, str]
    payload: Dict[str, Any]
    sender_id: Optional[str] = None
    target_id: Optional[str] = None

class ConnectionManager:
    """
    ENTERPRISE CONNECTION MANAGER:
    Handles multi-tenant real-time bridges with Redis-backed distributed scaling.
    """
    def __init__(self):
        # We use str for user_id to support UUIDs across all portals
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.pubsub_task = None

    async def connect(self, user_id: Union[str, uuid.UUID], websocket: WebSocket):
        user_id_str = str(user_id)
        await websocket.accept()
        if user_id_str not in self.active_connections:
            self.active_connections[user_id_str] = set()
        self.active_connections[user_id_str].add(websocket)
        logger.info(f"WS_CONNECT: user={user_id_str} | pool={len(self.active_connections[user_id_str])}")
        
        # Start the pubsub listener ONLY if Redis is enabled
        from app.core.config import settings
        if settings.USE_REDIS and self.pubsub_task is None:
            self.pubsub_task = asyncio.create_task(self._listen_to_redis())

    def disconnect(self, user_id: Union[str, uuid.UUID], websocket: WebSocket):
        user_id_str = str(user_id)
        if user_id_str in self.active_connections:
            self.active_connections[user_id_str].discard(websocket)
            if not self.active_connections[user_id_str]:
                del self.active_connections[user_id_str]
        logger.info(f"WS_DISCONNECT: user={user_id_str}")

    async def _listen_to_redis(self):
        """Background task to listen to Redis Pub/Sub independently of any single websocket."""
        try:
            client = redis_service.get_client()
            pubsub = client.pubsub()
            await pubsub.subscribe("hospyn_realtime_events")
            
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    data = json.loads(message['data'])
                    target_user_id = data.get("target_user_id")
                    payload_str = data.get("payload")
                    
                    if target_user_id is not None:
                        # Personal message
                        if target_user_id in self.active_connections:
                            disconnected = []
                            for connection in self.active_connections[target_user_id]:
                                try:
                                    await connection.send_text(payload_str)
                                except Exception:
                                    disconnected.append(connection)
                            for conn in disconnected:
                                self.disconnect(target_user_id, conn)
                    else:
                        # Global Broadcast
                        for uid, connections in list(self.active_connections.items()):
                            disconnected = []
                            for connection in connections:
                                try:
                                    await connection.send_text(payload_str)
                                except Exception:
                                    disconnected.append(connection)
                            for conn in disconnected:
                                self.disconnect(uid, conn)
        except Exception as e:
            logger.error(f"WS_REDIS_PUBSUB_CRASH: {e}")
            self.pubsub_task = None

    async def broadcast_to_hospital(self, hospyn_id: str, message: Any):
        """
        TENANT-AWARE BROADCAST:
        In a real multi-tenant system, this would filter by users belonging to hospyn_id.
        Currently defaults to global broadcast for simplicity, but prepared for RLS sync.
        """
        payload = message if isinstance(message, str) else json.dumps(message)
        
        # In production with Redis, we'd publish to a tenant-specific channel
        await self.broadcast(RealtimeMessage(type="TENANT_UPDATE", payload={"hospyn_id": hospyn_id, "data": message}))

    async def send_personal_message(self, message: RealtimeMessage, user_id: Union[str, uuid.UUID]):
        """Send message to a specific user. Uses Redis if enabled, else direct delivery."""
        from app.core.config import settings
        user_id_str = str(user_id)
        
        if settings.USE_REDIS:
            try:
                client = redis_service.get_client()
                data = {
                    "target_user_id": user_id_str,
                    "payload": message.model_dump_json()
                }
                await client.publish("hospyn_realtime_events", json.dumps(data))
                return
            except Exception as e:
                logger.error(f"WS_REDIS_PUBLISH_FAIL: {e}")

        # Local/Memory Fallback
        if user_id_str in self.active_connections:
            payload_str = message.model_dump_json()
            disconnected = []
            for connection in self.active_connections[user_id_str]:
                try:
                    await connection.send_text(payload_str)
                except Exception:
                    disconnected.append(connection)
            for conn in disconnected:
                self.disconnect(user_id_str, conn)

    async def broadcast(self, message: RealtimeMessage):
        """Broadcast message to all users. Uses Redis if enabled, else direct delivery."""
        from app.core.config import settings

        if settings.USE_REDIS:
            try:
                client = redis_service.get_client()
                data = {
                    "target_user_id": None,
                    "payload": message.model_dump_json()
                }
                await client.publish("hospyn_realtime_events", json.dumps(data))
                return
            except Exception as e:
                logger.error(f"WS_REDIS_BROADCAST_FAIL: {e}")

        # Local/Memory Fallback
        payload_str = message.model_dump_json()
        for uid, connections in list(self.active_connections.items()):
            disconnected = []
            for connection in connections:
                try:
                    await connection.send_text(payload_str)
                except Exception:
                    disconnected.append(connection)
            for conn in disconnected:
                self.disconnect(uid, conn)

manager = ConnectionManager()
