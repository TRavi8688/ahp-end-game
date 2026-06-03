import httpx
import asyncio
import time

TARGET_URL = "http://localhost:8000/health"
CONCURRENT_REQUESTS = 50
TOTAL_REQUESTS = 500

async def send_request(client, task_id):
    try:
        start = time.time()
        response = await client.get(TARGET_URL)
        duration = time.time() - start
        return response.status_code, duration
    except Exception as e:
        return 0, 0

async def simulate_dos():
    print(f"Starting DoS / Stress Test Simulation on {TARGET_URL}...")
    print(f"Sending {TOTAL_REQUESTS} requests ({CONCURRENT_REQUESTS} concurrent)...")
    
    results = []
    start_total = time.time()
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = []
        for i in range(TOTAL_REQUESTS):
            tasks.append(send_request(client, i))
            
            # Batching to maintain concurrency level
            if len(tasks) >= CONCURRENT_REQUESTS:
                batch_results = await asyncio.gather(*tasks)
                results.extend(batch_results)
                tasks = []
        
        if tasks:
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)

    total_duration = time.time() - start_total
    
    # Analyze results
    success_count = len([r for r in results if r[0] == 200])
    rate_limited_count = len([r for r in results if r[0] == 429])
    error_count = len([r for r in results if r[0] == 0 or r[0] >= 500])
    
    avg_latency = sum([r[1] for r in results if r[1] > 0]) / len(results) if results else 0
    
    print("\n--- DoS Test Results ---")
    print(f"Successes (200 OK): {success_count}")
    print(f"Rate Limited (429): {rate_limited_count}")
    print(f"Errors/Crashes: {error_count}")
    print(f"Avg Latency: {avg_latency:.4f}s")
    print(f"Total Time: {total_duration:.2f}s")
    print(f"Requests/sec: {TOTAL_REQUESTS/total_duration:.2f}")

if __name__ == "__main__":
    asyncio.run(simulate_dos())
