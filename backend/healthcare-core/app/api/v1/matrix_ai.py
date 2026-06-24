from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import httpx
import os
from app.core.security import get_current_user, TokenPayload

router = APIRouter()

class ChatBody(BaseModel):
    messages: List[Dict[str, Any]]
    system: str = None

@router.post("/chat")
async def chat_proxy(
    body: ChatBody,
    current_user: TokenPayload = Depends(get_current_user)
):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set on the server")

    # Map roles to Gemini roles ('user' or 'model')
    contents = []
    for msg in body.messages:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg.get("content", "")}]
        })

    payload = {
        "contents": contents
    }

    if body.system:
        payload["systemInstruction"] = {
            "parts": [{"text": body.system}]
        }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, timeout=30.0)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            res_data = response.json()
            try:
                ai_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                ai_text = "Error: Could not parse response from Gemini."

            return {
                "content": [
                    {
                        "text": ai_text
                    }
                ]
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
