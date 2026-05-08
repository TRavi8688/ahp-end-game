from fastapi.testclient import TestClient
from app.main import app
import json

client = TestClient(app)

print("--- Testing /api/v1/auth/send-otp ---")
response = client.post(
    "/api/v1/auth/send-otp",
    json={"identifier": "1234567890", "country_code": "+91"}
)
print(f"Status: {response.status_code}")
print(f"Body: {response.text}")

print("\n--- Testing /api/v1/patient/upload-report ---")
response = client.post("/api/v1/patient/upload-report", files={"file": ("test.txt", "content")})
print(f"Status: {response.status_code}")
print(f"Body: {response.text}")
