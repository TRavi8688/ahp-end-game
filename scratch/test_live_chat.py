import asyncio
import httpx
import base64
from datetime import timedelta
from app.core.security import create_access_token

async def main():
    # 1. Create a token for an admin/test user
    # Assuming user ID is a UUID string. We can just invent one for the token
    test_user_id = "00000000-0000-0000-0000-000000000001"
    token = create_access_token(
        data={"sub": test_user_id}, 
        expires_delta=timedelta(minutes=15)
    )
    
    # 2. Prepare payload
    b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    img_bytes = base64.b64decode(b64)
    
    # Note: the API expects multipart/form-data
    files = {
        'files': ('test.jpg', img_bytes, 'image/jpeg')
    }
    data = {
        'text': 'What is this image?'
    }
    headers = {
        'Authorization': f'Bearer {token}'
    }
    
    # 3. Hit the Cloud Run API
    url = "https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1/patient/chat"
    print(f"Testing POST {url}")
    async with httpx.AsyncClient() as client:
        res = await client.post(url, data=data, files=files, headers=headers, timeout=60.0)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")

if __name__ == "__main__":
    asyncio.run(main())
