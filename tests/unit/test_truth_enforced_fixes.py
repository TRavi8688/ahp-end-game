import pytest
import uuid
from fastapi import HTTPException
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.services.ai_service import AsyncAIService

@pytest.mark.asyncio
async def test_token_type_enforcement():
    user_id = str(uuid.uuid4())
    
    # 1. Access Token should pass validation for 'access' type
    access_token = create_access_token(user_id, role="patient")
    payload = decode_token(access_token, token_type="access")
    assert payload["type"] == "access"
    
    # 2. Refresh Token should fail when decoded as 'access'
    refresh_token = create_refresh_token(user_id, role="patient")
    payload_fail = decode_token(refresh_token, token_type="access")
    assert payload_fail is None

@pytest.mark.asyncio
async def test_ai_timeout_reduction():
    ai_service = AsyncAIService()
    client = await ai_service.get_client()
    # Check if timeout is 10s
    assert client.timeout.connect == 10.0
    assert client.timeout.read == 10.0
