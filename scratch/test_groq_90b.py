import asyncio
import requests
import base64
from app.services.ai_service import get_ai_service

async def main():
    ai = await get_ai_service()
    
    if ai.groq_key:
        print("\nTesting Groq 90b vision with URL...")
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {ai.groq_key}"}
        payload = {
            "model": "llama-3.2-90b-vision-preview",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What is this?"},
                        {"type": "image_url", "image_url": {"url": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Image_created_with_a_mobile_phone.png"}}
                    ]
                }
            ],
            "max_tokens": 1024
        }
        res = requests.post(url, headers=headers, json=payload)
        print("Groq URL response:", res.status_code, res.text[:200])

if __name__ == "__main__":
    asyncio.run(main())
