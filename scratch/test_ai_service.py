import asyncio
from app.services.ai_service import get_ai_service

async def test_ai():
    print(">>> Testing AI Service...")
    ai = await get_ai_service()
    resp = await ai.unified_ai_engine("Hello, are you working?")
    print(f">>> Response: {resp}")

if __name__ == "__main__":
    asyncio.run(test_ai())
