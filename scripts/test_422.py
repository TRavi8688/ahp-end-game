import asyncio
import aiohttp
import json
import logging

logging.basicConfig(level=logging.INFO)

async def test_prescription_payload():
    url = "https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1/clinical/prescriptions"
    
    # We will send a POST request with an empty body to see what 422 fields are required!
    # Without Auth, we might get 401. But let's check!
    
    payload = {
        "patient_id": "Hospyn-000000-TEST",
        "visit_id": None,
        "diagnosis": None,
        "notes": None,
        "medications": [
            {
                "name": "Paracetamol 500mg",
                "dosage": "1 tab",
                "frequency": "OD",
                "duration": "5 days",
                "instructions": None
            }
        ]
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as resp:
            print("STATUS:", resp.status)
            body = await resp.text()
            print("BODY:", body)

if __name__ == "__main__":
    asyncio.run(test_prescription_payload())
