import asyncio
import base64
from app.services.ai_service import get_ai_service
from app.database import async_session_maker

async def test_chat():
    ai = await get_ai_service()
    
    # 1x1 JPEG base64
    b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    img_bytes = base64.b64decode(b64)
    
    print("Testing chat_with_memory...")
    try:
        async with async_session_maker() as db:
            res = await ai.chat_with_memory(
                user_id="123e4567-e89b-12d3-a456-426614174000",
                conversation_id="test_conv",
                prompt="What is this?",
                db=db,
                image_bytes_list=[img_bytes]
            )
            print("Chat response:", repr(res))
    except Exception as e:
        print("Chat error:", e)

if __name__ == "__main__":
    asyncio.run(test_chat())
