import asyncio
import httpx
import time
import statistics
from typing import List

# Target: Simulate 100 concurrent workers making 10 requests each = 1,000 requests burst.
# Scale as needed for the 10,000 user baseline.

API_URL = "http://localhost:8000/api/v1/health" # Or any public endpoint

async def simulate_user(user_id: int):
    results = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for i in range(5):
            start = time.time()
            try:
                resp = await client.get(API_URL)
                latency = (time.time() - start) * 1000
                results.append({"status": resp.status_code, "latency": latency})
            except Exception as e:
                results.append({"status": "fail", "latency": 0, "error": str(e)})
            await asyncio.sleep(0.1) # Think time
    return results

async def run_load_test(concurrency: int = 100):
    print(f"LOAD_TEST: Starting simulation with {concurrency} concurrent users...")
    start_time = time.time()
    
    tasks = [simulate_user(i) for i in range(concurrency)]
    all_results = await asyncio.gather(*tasks)
    
    total_time = time.time() - start_time
    flattened = [item for sublist in all_results for item in sublist]
    
    successes = [r for r in flattened if r["status"] == 200]
    failures = [r for r in flattened if r["status"] != 200]
    latencies = [r["latency"] for r in successes]
    
    print("\n--- ENTERPRISE LOAD TEST RESULTS ---")
    print(f"Total Requests: {len(flattened)}")
    print(f"Success Rate: {(len(successes)/len(flattened))*100:.2f}%")
    print(f"Failure Rate: {(len(failures)/len(flattened))*100:.2f}%")
    if latencies:
        print(f"Avg Latency: {statistics.mean(latencies):.2f}ms")
        print(f"P95 Latency: {statistics.quantiles(latencies, n=20)[18]:.2f}ms")
    print(f"Throughput: {len(flattened)/total_time:.2f} req/s")
    print(f"Test Duration: {total_time:.2f}s")
    print("------------------------------------\n")

if __name__ == "__main__":
    asyncio.run(run_load_test(100))
