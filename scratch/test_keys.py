import asyncio
import os
import requests
import base64
from app.services.ai_service import get_ai_service

async def main():
    ai = await get_ai_service()
    
    print("Gemini Key starts with:", (ai.gemini_key[:5] + "...") if ai.gemini_key else "None")
    print("Groq Key starts with:", (ai.groq_key[:5] + "...") if ai.groq_key else "None")
    
    # Let's test a valid remote image URL for Groq instead of base64
    if ai.groq_key:
        print("\nTesting Groq with URL...")
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {ai.groq_key}"}
        payload = {
            "model": "llama-3.2-11b-vision-preview",
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

        print("\nTesting Groq with base64...")
        # Get base64 of the image
        img_res = requests.get("https://upload.wikimedia.org/wikipedia/commons/b/b6/Image_created_with_a_mobile_phone.png")
        b64 = base64.b64encode(img_res.content).decode('utf-8')
        payload["messages"][0]["content"][1]["image_url"]["url"] = f"data:image/png;base64,{b64}"
        
        res = requests.post(url, headers=headers, json=payload)
        print("Groq B64 response:", res.status_code, res.text[:200])

if __name__ == "__main__":
    asyncio.run(main())
