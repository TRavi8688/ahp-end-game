import httpx
import asyncio

API_URL = "http://localhost:8000/api/v1/auth/register"

PAYLOADS = [
    {"email": "admin' --", "password": "password123"}, # SQL Injection attempt
    {"email": "test@example.com", "password": "'; DROP TABLE users; --"}, # SQL Injection attempt
    {"email": "<script>alert('xss')</script>@example.com", "password": "password123"}, # XSS attempt
    {"email": "test@example.com", "password": "${7*7}"}, # Template injection attempt
]

async def simulate_injections():
    print(f"Starting Injection / Sanitization Simulation...")
    
    async with httpx.AsyncClient() as client:
        for i, payload in enumerate(PAYLOADS):
            print(f"Injecting Payload {i+1}: {payload}")
            try:
                response = await client.post(API_URL, json=payload)
                if response.status_code == 500:
                    print(f"POTENTIAL CRASH: Payload {i+1} caused server error 500!")
                elif response.status_code == 200:
                    print(f"Payload {i+1} accepted. Verify DB manually for sanitization.")
                else:
                    print(f"HANDLED: Status {response.status_code}")
            except Exception as e:
                print(f"Error injecting payload {i+1}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(simulate_injections())
