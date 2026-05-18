import asyncio
import os
from dotenv import load_dotenv
import httpx

load_dotenv()

async def test_groq():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return "No GROQ_API_KEY"
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}"}
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 10
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        return f"Groq status: {resp.status_code}, {resp.text[:100]}"

async def test_gemini():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return "No GEMINI_API_KEY"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
    payload = {"contents": [{"parts": [{"text": "Hi"}]}]}
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload)
        return f"Gemini status: {resp.status_code}, {resp.text[:100]}"

async def main():
    print(await test_groq())
    print(await test_gemini())

asyncio.run(main())
