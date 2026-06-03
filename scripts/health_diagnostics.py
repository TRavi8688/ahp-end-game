import httpx
import asyncio
import sys
import os

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
SERVICES = {
    "API Liveness": f"{API_BASE}/healthz",
    "API Readiness (DB/Redis)": f"{API_BASE}/readyz",
    "Prometheus Metrics": f"{API_BASE}/metrics",
}

async def check_service(name, url):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                print(f"[OK] {name}: {url}")
                return True
            else:
                print(f"[FAIL] {name}: {url} (Status: {resp.status_code})")
                return False
    except Exception as e:
        print(f"[ERROR] {name}: {url} ({str(e)})")
        return False

async def main():
    print(f"--- AHP 2.0 SYSTEM DIAGNOSTICS ({API_BASE}) ---")
    results = await asyncio.gather(*(check_service(n, u) for n, u in SERVICES.items()))
    
    if all(results):
        print("\nSYSTEM_HEALTHY: All critical endpoints responding.")
        sys.exit(0)
    else:
        print("\nSYSTEM_UNHEALTHY: One or more services failed.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
