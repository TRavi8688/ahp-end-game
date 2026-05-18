import asyncio
import os
from dotenv import load_dotenv
import httpx

load_dotenv()

async def list_gemini_models():
    key = os.getenv("GEMINI_API_KEY")
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.status_code, resp.text

async def main():
    print(await list_gemini_models())

asyncio.run(main())
