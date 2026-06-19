import httpx
import asyncio

API_BASE = "http://localhost:8000/api/v1"

async def simulate_idor():
    print(f"Starting IDOR / Authorization Simulation...")
    
    # In a real attack, the attacker has a valid token for THEIR account (e.g. ID 1)
    # and tries to access data for another account (e.g. ID 99)
    attacker_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Example token
    
    headers = {"Authorization": f"Bearer {attacker_token}"}
    
    # Target endpoints that might be vulnerable to IDOR
    targets = [
        f"{API_BASE}/patient/dashboard", # Usually tied to token, not ID in URL
    ]
    
    async with httpx.AsyncClient() as client:
        for url in targets:
            print(f"Probing: {url}")
            try:
                # We expect 403 or 401 if token is invalid/unauthorized
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    print(f"VULNERABILITY FOUND: Accessed {url} with unauthorized token!")
                elif response.status_code == 403:
                    print(f"PROTECTED: 403 Forbidden for {url}")
                else:
                    print(f"Response {response.status_code} for {url}")
            except Exception as e:
                print(f"Error probing {url}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(simulate_idor())
