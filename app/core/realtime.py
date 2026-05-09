import json
import asyncio
from enum import Enum
from typing import Dict, Set, List, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from app.core.logging import logger
from app.services.redis_service import redis_service

class MessageType(str, Enum):
    NEW_RECORD = "new_record"
    ANALYSIS_COMPLETE = "analysis_complete"
    DASHBOARD_UPDATE = "dashboard_update"
    CHAT_MESSAGE = "chat_message"
    CONSULTATION_START = "consultation_start"
    CONSENT_REQUEST = "consent_request"

class RealtimeMessage(BaseModel):
    type: MessageType
    payload: Dict[str, Any]
    sender_id: Optional[str] = None
    target_id: Optional[str] = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self.pubsub_task = None

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected. Active connections: {len(self.active_connections[user_id])}")
        
        # Start the pubsub listener ONLY if Redis is enabled
        from app.core.config import settings
        if settings.USE_REDIS and self.pubsub_task is None:
            self.pubsub_task = asyncio.create_task(self._listen_to_redis())

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected.")

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
                        # Broadcast
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
            logger.error(f"Redis PubSub listener failed: {e}")
            self.pubsub_task = None

    async def send_personal_message(self, message: RealtimeMessage, user_id: int):
        """Send message to a specific user. Uses Redis if enabled, else direct delivery."""
        from app.core.config import settings
        
        if settings.USE_REDIS:
            try:
                client = redis_service.get_client()
                data = {
                    "target_user_id": user_id,
                    "payload": message.model_dump_json()
                }
                await client.publish("hospyn_realtime_events", json.dumps(data))
                return
            except Exception as e:
                logger.error(f"Redis Publish failed, falling back to local: {e}")

        # Local/Memory Fallback
        if user_id in self.active_connections:
            payload_str = message.model_dump_json()
            disconnected = []
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(payload_str)
                except Exception:
                    disconnected.append(connection)
            for conn in disconnected:
                self.disconnect(user_id, conn)

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
                logger.error(f"Redis Broadcast failed, falling back to local: {e}")

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
