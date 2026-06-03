import httpx
import asyncio
import time

API_URL = "http://localhost:8000/api/v1/auth/login"

async def simulate_brute_force():
    print(f"Starting Brute Force Simulation against {API_URL}...")
    
    async with httpx.AsyncClient() as client:
        for i in range(1, 11): # Try 10 times rapidly
            payload = {
                "email": "victim@example.com",
                "password": f"wrongpass{i}"
            }
            start_time = time.time()
            try:
                response = await client.post(API_URL, json=payload)
                duration = time.time() - start_time
                
                status = response.status_code
                if status == 429:
                    print(f"Attempt {i}: [BLOCKED] 429 Too Many Requests (Rate limit hit!)")
                elif status == 401:
                    print(f"Attempt {i}: [FAILED] 401 Unauthorized (Password wrong)")
                elif status == 501: # Our current placeholder for login
                     print(f"Attempt {i}: [BYPASSED] 501 Not Implemented (Rate limit check pass pending implementation)")
                else:
                    print(f"Attempt {i}: Status {status}")
                    
            except Exception as e:
                print(f"Attempt {i}: [ERROR] {str(e)}")
            
            # No sleep to simulate rapid attack

if __name__ == "__main__":
    asyncio.run(simulate_brute_force())
