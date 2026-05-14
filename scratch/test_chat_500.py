import asyncio
import uuid
import httpx
from app.core import security

async def test_chat():
    user_id = "0b708c6b-64df-493c-9fb6-ea307132a117"
    token = security.create_access_token(user_id, "patient")
    
    url = "http://localhost:8080/api/v1/patient/chat"
    headers = {"Authorization": f"Bearer {token}"}
    data = {"text": "Tell me about my allergies."}
    
    async with httpx.AsyncClient() as client:
        try:
            # Note: /chat uses Form data
            resp = await client.post(url, headers=headers, data=data)
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_chat())
