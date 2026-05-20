import pytest
from app.core.realtime import ConnectionManager, RealtimeMessage, MessageType
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_websocket_manager_lifecycle():
    """Verify that the ConnectionManager correctly tracks and notifies users."""
    manager = ConnectionManager()
    mock_ws = AsyncMock()
    user_id = "123"
    
    # Test connection
    await manager.connect(user_id, mock_ws)
    assert user_id in manager.active_connections
    assert len(manager.active_connections[user_id]) == 1
    
    # Test broadcast
    msg = RealtimeMessage(type=MessageType.NEW_RECORD, payload={"id": 1})
    await manager.send_personal_message(msg, user_id)
    assert mock_ws.send_text.called
    
    # Test disconnection
    manager.disconnect(user_id, mock_ws)
    assert user_id not in manager.active_connections
