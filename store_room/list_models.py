import asyncio
from app.core.config import settings
import google.generativeai as genai

async def list_models():
    genai.configure(api_key=settings.GEMINI_API_KEY)
    print("Available models:")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)

if __name__ == "__main__":
    asyncio.run(list_models())
