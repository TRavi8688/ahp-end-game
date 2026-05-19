import pytest
import uuid
import re
import io
import httpx
from PIL import Image
from httpx import AsyncClient
from app.main import app
from app.models.models import VerificationStatusEnum
from app.api.v1.endpoints.onboarding import OTP_STORE

def test_pan_card_regex_rules():
    """Verify that NSDL format requirements match Indian PAN standard structure."""
    pan_regex = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
    
    # Correct format
    assert re.match(pan_regex, "ABCDE1234F") is not None
    assert re.match(pan_regex, "HOSPN9081Z") is not None
    
    # Incorrect formats
    assert re.match(pan_regex, "ABCDE123F") is None  # Missing a digit
    assert re.match(pan_regex, "ABCD12345F") is None  # Too many digits
    assert re.match(pan_regex, "abcde1234f") is None  # Lowercase (must be uppercase)

@pytest.mark.asyncio
async def test_enterprise_onboarding_database_flow():
    """Verify the full forensic database onboarding sequence via compliant payloads."""
    transport = httpx.ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://testserver") as client:
        # Build unique hospital names and credentials
        random_prefix = uuid.uuid4().hex[:3].upper()
        hosp_name = f"{random_prefix} Clinique {uuid.uuid4().hex[:4].upper()}"
        reg_number = f"REG-MOCK-{uuid.uuid4().hex[:6].upper()}"
        
        # Dynamically generate structurally genuine JPEG & PNG files above 1KB
        cert_io = io.BytesIO()
        Image.new("RGB", (300, 300), color="blue").save(cert_io, format="PNG")
        valid_png_content = cert_io.getvalue()

        selfie_io = io.BytesIO()
        Image.new("RGB", (300, 300), color="red").save(selfie_io, format="JPEG")
        valid_jpeg_content = selfie_io.getvalue()

        # 1. Simulate registration with UPI Autopay
        response = await client.post(
            "/api/v1/onboarding/register-enterprise",
            data={
                "name": hosp_name,
                "registration_number": reg_number,
                "staff_count": 10,
                "owner_email": "owner@testclinique.com",
                "phone_number": "+919999988888",
                "pan_number": "ABCDE1234F",
                "physical_address": "123 MG Road, Bangalore, Karnataka",
                "latitude": 12.971598,
                "longitude": 77.594562,
                "payment_method_type": "upi",
                "upi_id": "owner@okhdfcbank"
            },
            files={
                "certificate": ("cert.png", valid_png_content, "image/png"),
                "selfie": ("selfie.jpg", valid_jpeg_content, "image/jpeg")
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"Onboarding failed with HTTP {response.status_code}: {response.text}")
            
        res_data = response.json()
        assert "hospital_id" in res_data
        assert res_data["is_pan_valid"] is True
        
        hosp_id = res_data["hospital_id"]
        
        # 2. Get status from database to confirm UPI subscription
        status_resp = await client.get(f"/api/v1/onboarding/hospital-status/{hosp_id}")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["name"] == hosp_name
        assert status_data["subscription"]["payment_method_type"] == "upi"
        assert status_data["subscription"]["upi_id"] == "owner@okhdfcbank"
        assert status_data["forensics"]["phone_otp_verified"] is False
        
        # 3. Request Mobile SMS OTP verification code
        otp_req = await client.post(f"/api/v1/onboarding/send-phone-otp/{hosp_id}")
        assert otp_req.status_code == 200
        
        # Retrieve the secure random dynamic OTP from our mock OTP_STORE
        uuid_hosp_id = uuid.UUID(hosp_id)
        dynamic_otp = OTP_STORE.get(uuid_hosp_id)
        assert dynamic_otp is not None
        assert len(dynamic_otp) == 6
        
        # 4. Verify OTP code and update Postgres state
        verify_resp = await client.post(
            f"/api/v1/onboarding/verify-phone-otp/{hosp_id}",
            data={"otp_code": dynamic_otp}
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["phone_otp_verified"] is True
        
        # Confirm status in database advanced to 'otp_verified'
        status_resp = await client.get(f"/api/v1/onboarding/hospital-status/{hosp_id}")
        assert status_resp.json()["verification_status"] == VerificationStatusEnum.otp_verified
        
        # 5. Super Admin Approval DB Action
        approve_resp = await client.post(f"/api/v1/onboarding/admin-approve-hospital/{hosp_id}")
        assert approve_resp.status_code == 200
        assert approve_resp.json()["is_approved"] is True
        
        # Confirm fully verified console access is unlocked
        status_resp = await client.get(f"/api/v1/onboarding/hospital-status/{hosp_id}")
        assert status_resp.json()["verification_status"] == VerificationStatusEnum.completed
        assert status_resp.json()["is_approved"] is True
