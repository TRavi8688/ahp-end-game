import requests
from app.services.ai_service import get_ai_service
import asyncio

async def main():
    ai = await get_ai_service()
    if ai.groq_key:
        url = "https://api.groq.com/openai/v1/models"
        headers = {"Authorization": f"Bearer {ai.groq_key}"}
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            models = res.json().get("data", [])
            for m in models:
                if "vision" in m["id"].lower():
                    print("Found vision model:", m["id"])
        else:
            print("Failed to list models:", res.text)

if __name__ == "__main__":
    asyncio.run(main())
