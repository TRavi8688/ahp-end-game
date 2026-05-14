import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app
import json

client = TestClient(app)

print("🚀 INITIATING SCHEMA STRESS TEST...")
try:
    response = client.get("/openapi.json")
    if response.status_code == 200:
        print("✅ SUCCESS: Schema generated correctly.")
    else:
        print(f"❌ FAILURE: Schema gen returned {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"🔥 CRASH DETECTED: {e}")
    import traceback
    traceback.print_exc()
