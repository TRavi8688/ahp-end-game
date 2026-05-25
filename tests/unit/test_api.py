import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import patch, AsyncMock

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Hospyn 2.0 Enterprise API"}

@patch("app.services.two_factor_service.send_sms_otp", new_callable=AsyncMock)
def test_send_otp(mock_send_sms_otp):
    mock_send_sms_otp.return_value = True
    response = client.post(
        "/api/v1/auth/send-otp",
        json={"identifier": "1234567890", "method": "sms"},
        headers={"X-Idempotency-Key": "test-otp-1"}
    )
    assert response.status_code == 200
    assert response.json()["success"] is True

def test_medical_upload_unauthorized():
    # Attempting upload without token
    response = client.post(
        "/api/v1/patient/upload-report", 
        files={"file": ("test.txt", "content")},
        headers={"X-Idempotency-Key": "test-upload-1"}
    )
    # oauth2_scheme returns 401 if token is missing
    assert response.status_code == 401
