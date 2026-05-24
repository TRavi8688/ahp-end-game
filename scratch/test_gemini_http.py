import asyncio
import httpx
from app.core.config import settings

async def test_gemini_http():
    api_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else None
    print(f"Gemini Key: {api_key}")
    if not api_key:
        print("No GEMINI_API_KEY found.")
        return

    # Test v1 with gemini-2.5-flash
    url_v1 = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [{"text": "Hello, how are you? Keep it extremely short."}]
        }]
    }

    async with httpx.AsyncClient() as client:
        try:
            print("Sending request to Gemini v1 endpoint...")
            resp = await client.post(url_v1, json=payload)
            print(f"v1 Status Code: {resp.status_code}")
            print(f"v1 Response: {resp.text}")
        except Exception as e:
            print(f"v1 request exception: {e}")

        # Test v1beta with gemini-2.5-flash
        url_beta = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        try:
            print("\nSending request to Gemini v1beta endpoint...")
            resp = await client.post(url_beta, json=payload)
            print(f"v1beta Status Code: {resp.status_code}")
            print(f"v1beta Response: {resp.text}")
        except Exception as e:
            print(f"v1beta request exception: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini_http())
