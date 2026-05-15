import asyncio
import httpx
import time
import random

# CONFIGURATION
API_BASE = "https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1"
CONCURRENT_USERS = 20
TEST_DURATION_SECONDS = 30
TOKEN = "" 

class ClinicalLoadTester:
    def __init__(self):
        self.results = []
        self.errors = 0
        self.error_codes = {}
        self.start_time = None

    async def simulate_health_check(self, client):
        """Baseline health probe."""
        start = time.perf_counter()
        try:
            resp = await client.get(f"{API_BASE.replace('/api/v1', '')}/health")
            latency = time.perf_counter() - start
            self.results.append(latency)
            if resp.status_code != 200:
                self.errors += 1
                self.error_codes[resp.status_code] = self.error_codes.get(resp.status_code, 0) + 1
        except Exception as e:
            self.errors += 1
            err_name = type(e).__name__
            self.error_codes[err_name] = self.error_codes.get(err_name, 0) + 1

    async def worker(self):
        async with httpx.AsyncClient(timeout=30.0) as client:
            while (time.time() - self.start_time) < TEST_DURATION_SECONDS:
                await self.simulate_health_check(client)
                await asyncio.sleep(random.uniform(0.1, 0.5))

    async def run(self):
        print(f"Starting Global Load Test: {CONCURRENT_USERS} concurrent users for {TEST_DURATION_SECONDS}s")
        self.start_time = time.time()
        tasks = [asyncio.create_task(self.worker()) for _ in range(CONCURRENT_USERS)]
        await asyncio.gather(*tasks)
        self.report()

    def report(self):
        total_requests = len(self.results)
        if total_requests == 0:
            print("No requests completed.")
            return

        avg_latency = sum(self.results) / total_requests
        p95_latency = sorted(self.results)[int(total_requests * 0.95)]
        throughput = total_requests / TEST_DURATION_SECONDS

        print("\n" + "="*40)
        print("LOAD TEST RESULTS (Phase 6)")
        print("="*40)
        print(f"Total Requests: {total_requests}")
        print(f"Success Rate:   {((total_requests - self.errors) / total_requests * 100):.2f}%")
        print(f"Throughput:     {throughput:.2f} req/s")
        print(f"Avg Latency:    {avg_latency * 1000:.2f} ms")
        print(f"P95 Latency:    {p95_latency * 1000:.2f} ms")
        print(f"Error Count:    {self.errors}")
        if self.error_codes:
            print("Error Breakdown:")
            for code, count in self.error_codes.items():
                print(f"  - {code}: {count}")
        print("="*40)

if __name__ == "__main__":
    tester = ClinicalLoadTester()
    asyncio.run(tester.run())
