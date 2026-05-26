import asyncio
import base64
import json
from app.core.config import settings
import google.generativeai as genai

async def test_ai():
    print(f"API KEY: {settings.GEMINI_API_KEY}")
    if not settings.GEMINI_API_KEY:
        print("NO KEY")
        return
        
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # small 1x1 jpeg image
        b64_data = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAGBAQABAAAAAA=="
        
        image_bytes = base64.b64decode(b64_data)
        image_parts = [{"mime_type": "image/jpeg", "data": image_bytes}]
        
        prompt = '''
        Analyze this image of a medicine wrapper/bottle. Extract the following details and return ONLY a valid JSON object. Do not include markdown formatting or backticks.
        JSON format:
        {
          "item_name": "string (brand name)",
          "generic_name": "string (salt/composition)",
          "batch_number": "string",
          "expiry_date": "YYYY-MM-DD",
          "unit_price": float (MRP)
        }
        '''
        print("Sending request to Gemini...")
        response = await asyncio.to_thread(model.generate_content, [prompt, image_parts[0]])
        print("Raw text:", response.text)
        
        text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text)
        print("JSON loaded:", data)
    except Exception as e:
        print("Exception:", str(e))

if __name__ == "__main__":
    asyncio.run(test_ai())
