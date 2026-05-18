import asyncio
import httpx
from app.services.ai_service import AsyncAIService

async def test_providers():
    ai = AsyncAIService()
    print("KEYS:")
    print("Gemini:", ai.gemini_key)
    print("Groq:", ai.groq_key)
    print("Anthropic:", ai.anthropic_key)
    print("InsForge Base URL:", ai.base_url)
    print("InsForge Anon Key:", ai.anon_key)
    
    prompt = "Hello! Who are you?"
    
    print("\nTesting Gemini...")
    res_gem = await ai._call_gemini("gemini-1.5-flash", prompt)
    print("Gemini Response:", repr(res_gem))
    
    print("\nTesting Groq...")
    res_groq = await ai._call_groq("llama-3.3-70b-versatile", prompt)
    print("Groq Response:", repr(res_groq))
    
    print("\nTesting InsForge...")
    res_ins = await ai._call_insforge_ai("deepseek/deepseek-v3", prompt)
    print("InsForge Response:", repr(res_ins))

if __name__ == "__main__":
    asyncio.run(test_providers())
