import asyncio
from app.services.ai_service import get_ai_service

async def test_ai():
    ai = await get_ai_service()
    prompt = "Hello, just say 'Test successful' if you can read this."
    print("Sending prompt to unified_ai_engine...")
    res = await ai.unified_ai_engine(prompt, skip_safety=True)
    print("Response:")
    print(res)

if __name__ == "__main__":
    asyncio.run(test_ai())
