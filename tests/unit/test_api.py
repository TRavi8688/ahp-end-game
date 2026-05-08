import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to AHP 2.0 Enterprise API"}

def test_send_otp():
    response = client.post(
        "/api/v1/auth/send-otp",
        json={"identifier": "1234567890", "country_code": "+91"},
        headers={"X-Idempotency-Key": "test-otp-1"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_medical_upload_unauthorized():
    # Attempting upload without token
    response = client.post(
        "/api/v1/patient/upload-report", 
        files={"file": ("test.txt", "content")},
        headers={"X-Idempotency-Key": "test-upload-1"}
    )
    # oauth2_scheme returns 401 if token is missing
    assert response.status_code == 401
