import asyncio
import aiohttp
import time
import random

API_BASE_URL = "http://localhost:8000/api/v1"

async def simulate_patient_workflow(session, patient_id):
    """
    Simulates a patient checking their records and chatting with Chitti.
    """
    headers = {"Authorization": f"Bearer mock_token_{patient_id}"}
    try:
        # 1. Fetch Timeline
        async with session.get(f"{API_BASE_URL}/clinical/timeline", headers=headers) as resp:
            await resp.text()
        
        # 2. Upload a Mock Report (Simulated)
        async with session.post(f"{API_BASE_URL}/patient/upload-report", headers=headers, data={"file": "mock_report_blob"}) as resp:
            await resp.text()
            
        return True
    except Exception as e:
        return False

async def run_stress_test(concurrency=1000):
    """
    Launches the clinical load simulation.
    """
    print(f"🚀 INITIATING CLINICAL STRESS TEST: {concurrency} Concurrent Sessions")
    start_time = time.time()
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        for i in range(concurrency):
            tasks.append(simulate_patient_workflow(session, i))
        
        results = await asyncio.gather(*tasks)
        
    duration = time.time() - start_time
    success_count = sum(1 for r in results if r)
    
    print("\n--- PERFORMANCE FORENSIC REPORT ---")
    print(f"Total Transactions: {concurrency}")
    print(f"Success Rate: {(success_count/concurrency)*100}%")
    print(f"Total Duration: {duration:.2f}s")
    print(f"Avg Latency: {(duration/concurrency)*1000:.2f}ms/request")
    print("------------------------------------\n")

if __name__ == "__main__":
    # In a real environment, we would run this.
    # asyncio.run(run_stress_test(1000))
    print("STRESS_TEST_READY: Execute in scratch/clinical_stress_test.py")
