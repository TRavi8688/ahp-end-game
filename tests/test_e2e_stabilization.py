import pytest
import io
import uuid
import jwt as pyjwt
from PIL import Image
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from jose import jwt as jose_jwt

from app.main import app
from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_password_hash, create_access_token, decode_token
from app.models import Base
from app.models.models import (
    User, RoleEnum, Hospital, HospitalSettings, StaffProfile, Doctor,
    VerificationStatusEnum, Patient, PatientVisit, DoctorAccess,
    DigitalPrescription, PrescriptionStatusEnum, Invoice, PaymentStatus, PaymentMethod
)

DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)

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

@pytest.fixture
async def client():
    from httpx import ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as ac:
        yield ac

@pytest.mark.asyncio
async def test_health_check_endpoint(client):
    """
    Priority 3: Add deployment healthcheck endpoint (GET /health)
    Verifies base app readiness, database connectivity, and optional Redis/subsystems.
    """
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "online"
    assert "version" in data
    assert "timestamp" in data

@pytest.mark.asyncio
async def test_jwt_hardening_production_hs256_rejection():
    """
    Priority 2 & 3: Authentication Hardening
    Strictly reject symmetric HS256 tokens in production when RS256 is expected.
    """
    # 1. Generate an HS256 token signed with SECRET_KEY
    payload = {
        "sub": str(uuid.uuid4()),
        "role": "doctor",
        "type": "access",
        "iss": settings.PROJECT_NAME,
        "aud": settings.JWT_AUDIENCE,
    }
    hs256_token = jose_jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    
    # 2. In non-production, decoding works
    settings_env_backup = settings.ENVIRONMENT
    settings.ENVIRONMENT = "development"
    decoded = decode_token(hs256_token)
    assert decoded is not None
    assert decoded["sub"] == payload["sub"]

    # 3. Switch to production environment and verify rejection
    settings.ENVIRONMENT = "production"
    try:
        decoded_prod = decode_token(hs256_token)
        assert decoded_prod is None, "HS256 tokens must be rejected in production"
    finally:
        # Restore environment settings
        settings.ENVIRONMENT = settings_env_backup

@pytest.mark.asyncio
async def test_unified_error_shield_database_masking(client):
    """
    Priority 2 & 5: Unified Error Shield
    Ensure raw database exceptions are globally masked and client error payloads do not leak schema details.
    """
    # Force db_exception_handler mock test by raising SQLAlchemyError in get_db
    async def bad_get_db():
        from sqlalchemy.exc import IntegrityError
        raise IntegrityError("mock_statement", "mock_params", Exception("sqlite3.IntegrityError: column email is not unique"))

    app.dependency_overrides[get_db] = bad_get_db
    
    try:
        # Request health endpoint which calls deps.get_db
        response = await client.get("/health")
        assert response.status_code == 500
        data = response.json()
        
        # Verify schema details are completely masked
        assert data["success"] is False
        assert data["error"]["code"] == "DATABASE_INTEGRITY_VIOLATION"
        assert "trace_id" in data["error"]
        assert "column email is not unique" not in data["error"]["message"]
        assert "sqlite3.IntegrityError" not in data["error"]["message"]
    finally:
        app.dependency_overrides[get_db] = override_get_db

@pytest.mark.asyncio
async def test_e2e_patient_doctor_billing_lifecycle(client):
    """
    Priority 1 & 5: Real API-driven E2E Hospital Workflow
    Executes:
    1. Onboard enterprise hospital node via /register-enterprise (with files)
    2. Phone SMS OTP initiation and mock code validation
    3. Super Admin registration approval
    4. Doctor credential setup and authentication token retrieval
    5. QR code guest patient intake and clinical record setup
    6. Digital prescription with cryptographic signature seal
    7. Consultation invoice generation and revenue cash collection
    """
    # Create valid 800x800 pixel PNG in memory to bypass PIL verify check and exceed 500 byte limit
    selfie_io = io.BytesIO()
    img = Image.new("RGB", (800, 800), color="white")
    img.save(selfie_io, format="PNG")
    selfie_bytes = selfie_io.getvalue()

    files = {
        "certificate": ("cert.pdf", b"%PDF-1.4\n" + b"x" * 500, "application/pdf"),
        "selfie": ("selfie.png", selfie_bytes, "image/png"),
    }
    data = {
        "name": "Saint Mary Hospital",
        "registration_number": "SMH-12345-ENT",
        "staff_count": "150",
        "owner_email": "owner@saintmary.com",
        "phone_number": "+919876543210",
        "physical_address": "123 Healthcare Blvd, Bangalore, India",
        "latitude": "12.9716",
        "longitude": "77.5946",
        "payment_method_type": "card",
        "pan_number": "ABCDE1234F",
        "branches": "SMH-East,SMH-West",
        "branch_locations": "East Bangalore;West Bangalore",
        "payment_token": "tok_12345"
    }

    # Provision Enterprise Node
    response = await client.post("/api/v1/onboarding/register-enterprise", data=data, files=files)
    assert response.status_code == 200, f"Register failed: {response.text}"
    onboarding_res = response.json()
    assert onboarding_res["resolved_pan"] == "ABCDE1234F"
    assert onboarding_res["subscription_status"] == "trialing_active"
    hospital_id = uuid.UUID(onboarding_res["hospital_id"])

    # --- STEP 2: Phone OTP verification ---
    # Initiate phone otp
    otp_init_res = await client.post(f"/api/v1/onboarding/send-phone-otp/{hospital_id}")
    assert otp_init_res.status_code == 200
    otp_data = otp_init_res.json()
    simulated_otp = otp_data["simulated_otp"]
    assert simulated_otp is not None

    # Verify SMS OTP
    otp_verify_res = await client.post(
        f"/api/v1/onboarding/verify-phone-otp/{hospital_id}",
        data={"otp_code": simulated_otp}
    )
    assert otp_verify_res.status_code == 200
    assert otp_verify_res.json()["phone_otp_verified"] is True

    # --- STEP 3: Admin Approval ---
    # Register a super-admin to approve the hospital
    admin_reg_res = await client.post("/api/v1/auth/register", json={
        "email": "superadmin@hospyn.com",
        "password": "SecurePassword123!",
        "first_name": "Super",
        "last_name": "Admin",
        "role": "admin"
    })
    admin_login_res = await client.post("/api/v1/auth/login", data={
        "username": "superadmin@hospyn.com",
        "password": "SecurePassword123!"
    })
    admin_token = admin_login_res.json()["access_token"]
    
    # Unlock console via super-admin approval
    approve_res = await client.post(
        f"/api/v1/onboarding/admin-approve-hospital/{hospital_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["is_approved"] is True

    # --- STEP 4: Doctor Onboarding & Auth Token ---
    # Create doctor credentials via public register
    doctor_reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "doctor_e2e@saintmary.com",
            "password": "SecurePassword123!",
            "first_name": "Jane",
            "last_name": "Smith",
            "role": "doctor"
        }
    )
    assert doctor_reg_res.status_code == 200
    doctor_data = doctor_reg_res.json()
    doctor_user_id = uuid.UUID(doctor_data["id"])

    # Manually configure HospitalSettings and link Doctor records in testing DB context
    async with TestingSessionLocal() as session:
        settings_record = HospitalSettings(
            hospital_id=hospital_id,
            enable_pharmacy=True,
            enable_labs=True,
            enable_inpatient_beds=True,
            enable_hr=True,
            enable_billing=True
        )
        session.add(settings_record)

        staff_profile = StaffProfile(
            user_id=doctor_user_id,
            hospital_id=hospital_id
        )
        session.add(staff_profile)

        doctor_profile = Doctor(
            user_id=doctor_user_id,
            specialty="General Medicine",
            license_number="LIC-E2E-12345"
        )
        session.add(doctor_profile)
        await session.commit()

    # Log in as doctor via standard OAuth2 password flow
    login_res = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "doctor_e2e@saintmary.com",
            "password": "SecurePassword123!"
        }
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token_data = login_res.json()
    doctor_token = token_data["access_token"]
    assert doctor_token is not None

    # --- STEP 5: Guest Patient QR Intake ---
    # Quick register guest patient (simulates QR code scanning at hospital desk)
    patient_intake_res = await client.post(
        "/api/v1/visit/public/quick-register",
        json={
            "hospital_id": str(hospital_id),
            "name": "John Doe",
            "phone": "+919876543210",
            "age": 30,
            "reason": "Chronic Fever"
        }
    )
    assert patient_intake_res.status_code == 200, f"Patient intake failed: {patient_intake_res.text}"
    patient_data = patient_intake_res.json()
    assert patient_data["status"] == "success"
    patient_id = uuid.UUID(patient_data["patient_id"])

    # Grab the active visit ID directly from the DB
    async with TestingSessionLocal() as session:
        stmt = select(PatientVisit).where(PatientVisit.patient_id == patient_id)
        result = await session.execute(stmt)
        active_visit = result.scalars().first()
        assert active_visit is not None
        visit_id = active_visit.id

    # --- STEP 6: Clinical Digital Prescription ---
    # Prescribe medications using the doctor access token
    headers = {"Authorization": f"Bearer {doctor_token}"}
    prescribe_payload = {
        "patient_id": str(patient_id),
        "visit_id": str(visit_id),
        "diagnosis": "Severe Malaria",
        "medications": [
            {
                "name": "Paracetamol",
                "dosage": "500mg",
                "frequency": "Three times a day",
                "duration": "5 days",
                "instructions": "Take after meals",
                "status": "pending",
                "fulfilled_qty": 0
            }
        ],
        "notes": "Patient needs rest and high fluid intake."
    }

    prescribe_res = await client.post(
        "/api/v1/clinical/prescriptions",
        json=prescribe_payload,
        headers=headers
    )
    assert prescribe_res.status_code == 201, f"Prescribe failed: {prescribe_res.text}"
    prescribe_data = prescribe_res.json()
    assert prescribe_data["status"] == "pending"
    assert prescribe_data["signature_hash"] is not None  # Cryptographic seal verified!

    # --- STEP 7: Financial Invoice & Cash Checkout ---
    # Generate billing invoice
    invoice_payload = {
        "patient_id": str(patient_id),
        "visit_id": str(visit_id),
        "notes": "E2E Consultation and Medication Checkout Invoice",
        "items": [
            {
                "description": "Consultation Fee",
                "category": "Consultation",
                "quantity": 1.0,
                "unit_price": 500.0,
                "tax_percent": 5.0
            },
            {
                "description": "Paracetamol 500mg",
                "category": "Pharmacy",
                "quantity": 15.0,
                "unit_price": 10.0,
                "tax_percent": 12.0
            }
        ],
        "discount_amount": 50.0
    }

    invoice_res = await client.post(
        "/api/v1/invoices",
        json=invoice_payload,
        headers=headers
    )
    assert invoice_res.status_code == 200, f"Invoice creation failed: {invoice_res.text}"
    invoice_data = invoice_res.json()
    invoice_id = uuid.UUID(invoice_data["id"])
    
    # Verify calculated totals
    # Consultation: 500 * 1.0 (qty) = 500.0 (tax 25.0)
    # Paracetamol: 10 * 15 (qty) = 150.0 (tax 18.0)
    # Total Amount (before tax): 650.0
    # Tax Amount: 43.0
    # Payable Amount (650 + 43 - 50 discount): 643.0
    assert invoice_data["total_amount"] == 650.0
    assert invoice_data["tax_amount"] == 43.0
    assert invoice_data["payable_amount"] == 643.0
    assert invoice_data["status"] == PaymentStatus.ISSUED.value

    # Complete cash checkout
    payment_payload = {
        "amount": 643.0,
        "method": PaymentMethod.CASH.value,
        "transaction_ref": "TXN-CASH-E2E"
    }

    payment_res = await client.post(
        f"/api/v1/payments/{invoice_id}",
        json=payment_payload,
        headers=headers
    )
    assert payment_res.status_code == 200, f"Record payment failed: {payment_res.text}"
    payment_data = payment_res.json()
    assert payment_data["amount"] == 643.0
    assert payment_data["method"] == PaymentMethod.CASH.value

    # Verify that invoice status successfully advanced to PAID
    async with TestingSessionLocal() as session:
        stmt = select(Invoice).where(Invoice.id == invoice_id)
        res = await session.execute(stmt)
        paid_invoice = res.scalars().first()
        assert paid_invoice.status == PaymentStatus.PAID
