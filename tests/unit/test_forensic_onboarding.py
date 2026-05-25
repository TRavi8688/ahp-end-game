import pytest
import uuid
import re
import io
import httpx
from PIL import Image
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.models import Base, VerificationStatusEnum
from app.core.database import get_db
from app.api.v1.endpoints.onboarding import OTP_STORE

DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(engine, autocommit=False, autoflush=False, expire_on_commit=False, class_=AsyncSession)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

@pytest.fixture(autouse=True)
async def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()


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
        await client.post("/api/v1/auth/register", json={
            "email": "superadmin_forensic@hospyn.com",
            "password": "SecurePassword123!",
            "first_name": "Super",
            "last_name": "Admin",
            "role": "admin"
        })
        admin_login = await client.post("/api/v1/auth/login", data={
            "username": "superadmin_forensic@hospyn.com",
            "password": "SecurePassword123!"
        })
        admin_token = admin_login.json()["access_token"]
        
        approve_resp = await client.post(
            f"/api/v1/onboarding/admin-approve-hospital/{hosp_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert approve_resp.status_code == 200
        
        # Confirm fully verified console access is unlocked
        status_resp = await client.get(f"/api/v1/onboarding/hospital-status/{hosp_id}")
        assert status_resp.json()["verification_status"] == VerificationStatusEnum.completed
        assert status_resp.json()["is_approved"] is True


@pytest.mark.asyncio
async def test_invite_staff_member_with_existing_user():
    """Verify that invite_staff_member succeeds even if the user already exists in the database."""
    from app.services.staff_service import StaffService
    from app.models.models import User, RoleEnum, StaffProfile, Hospital
    
    async with TestingSessionLocal() as db:
        # Create a mock hospital first
        hospital = Hospital(
            id=uuid.uuid4(),
            hospyn_id="HOSP-1234",
            short_code="HOSP12",
            name="Test Hospital",
            registration_number="REG12345"
        )
        db.add(hospital)
        await db.flush()
        
        # Create an existing user (e.g. inviter)
        inviter = User(
            id=uuid.uuid4(),
            email="inviter@test.com",
            hashed_password="hashed_pass",
            role=RoleEnum.admin,
            is_active=True
        )
        db.add(inviter)
        await db.flush()
        
        # Give inviter a staff profile
        inviter_staff = StaffProfile(
            user_id=inviter.id,
            hospital_id=hospital.id,
            job_title="Admin"
        )
        db.add(inviter_staff)
        await db.flush()
        
        # Create a target user that ALREADY exists (the staff member we want to invite)
        existing_staff_email = "existing_staff@test.com"
        existing_user = User(
            id=uuid.uuid4(),
            email=existing_staff_email,
            hashed_password="hashed_pass",
            role=RoleEnum.doctor,
            is_active=True
        )
        db.add(existing_user)
        await db.flush()
        
        # Invite this existing user - this previously threw UnboundLocalError
        invite, raw_token, temp_password, staff_hospyn_id = await StaffService.invite_staff_member(
            db=db,
            inviter_user_id=inviter.id,
            hospital_id=hospital.id,
            hospital_hospyn_id="HOSP-1234",
            email=existing_staff_email,
            role="doctor",
            phone_number="+919999999999",
            specialty="Cardiology",
            job_title="Senior Cardiologist"
        )
        
        assert invite is not None
        assert raw_token is not None
        assert temp_password is not None
        assert staff_hospyn_id is not None

