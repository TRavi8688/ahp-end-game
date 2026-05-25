import asyncio
import base64
from app.services.ai_service import get_ai_service

async def test_vision():
    ai = await get_ai_service()
    
    # 1x1 JPEG base64
    b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    img_bytes = base64.b64decode(b64)
    
    print("Testing gemini-2.5-flash vision...")
    try:
        res = await ai._call_gemini(
            model_name="gemini-2.5-flash",
            prompt="What is this?",
            image_bytes=img_bytes,
            mime_type="image/jpeg"
        )
        print("Gemini response:", res)
    except Exception as e:
        print("Gemini error:", e)

if __name__ == "__main__":
    asyncio.run(test_vision())
