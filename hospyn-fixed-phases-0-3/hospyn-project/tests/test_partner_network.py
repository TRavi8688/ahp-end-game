import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient
import uuid

from app.main import app
from app.models.models import Base, User, Hospital, Patient, LabDiagnosticOrder, RoleEnum, OrganizationTypeEnum, StaffProfile, Doctor
from app.core.security import create_access_token
from app.core.database import get_db

DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
from sqlalchemy.orm import sessionmaker
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

@pytest.fixture
async def client():
    from httpx import ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as ac:
        yield ac

@pytest.fixture
async def setup_data():
    async with TestingSessionLocal() as session:
        # Create Referring Clinic
        clinic = Hospital(name="City Clinic", registration_number="CLN-01", hospyn_id="HOSP-CLN", short_code="CLN", org_type=OrganizationTypeEnum.hospital)
        # Create Partner Lab
        partner_lab = Hospital(name="Apex Diagnostics", registration_number="LAB-01", hospyn_id="PLAB-APEX", short_code="APEX", org_type=OrganizationTypeEnum.lab)
        session.add_all([clinic, partner_lab])
        await session.flush()

        # Create Patient
        patient_user = User(email="patient@test.com", hashed_password="hashed", role=RoleEnum.patient, hospyn_id="PAT-TEST")
        session.add(patient_user)
        await session.flush()
        
        patient = Patient(user_id=patient_user.id, hospyn_id="PAT-TEST-001", phone_number="1234567890", language_code="en")
        session.add(patient)
        await session.flush()

        # Create Doctor at Clinic
        doctor_user = User(email="doctor@test.com", hashed_password="hashed", role=RoleEnum.doctor)
        session.add(doctor_user)
        await session.flush()
        
        doctor_staff = StaffProfile(user_id=doctor_user.id, hospital_id=clinic.id)
        session.add(doctor_staff)
        await session.flush()
        
        doctor = Doctor(user_id=doctor_user.id, license_number="DOC-01")
        session.add(doctor)
        await session.flush()

        # Create Partner Lab Tech
        lab_user = User(email="tech@apex.com", hashed_password="hashed", role=RoleEnum.nurse) # Staff equivalent
        session.add(lab_user)
        await session.flush()
        
        lab_staff = StaffProfile(user_id=lab_user.id, hospital_id=partner_lab.id)
        session.add(lab_staff)
        await session.flush()

        # Create Lab Order at Clinic
        order = LabDiagnosticOrder(
            hospital_id=clinic.id,
            doctor_id=doctor.id,
            patient_id=patient.id,
            tests={"items": ["CBC", "Lipid Profile"]}
        )
        session.add(order)
        await session.flush()
        
        await session.commit()
        return {
            "patient_user": patient_user.id,
            "patient_id": patient.id,
            "lab_user": lab_user.id,
            "clinic_id": clinic.id,
            "partner_lab_id": partner_lab.id,
            "order_id": order.id
        }

@pytest.mark.asyncio
async def test_partner_lab_referral_flow(client: AsyncClient, setup_data):
    # 1. Patient requests referral
    patient_token = create_access_token(subject=str(setup_data["patient_user"]), role="patient")
    req_payload = {
        "order_id": str(setup_data["order_id"]),
        "partner_hospital_id": str(setup_data["partner_lab_id"])
    }
    resp = await client.post(
        "/api/v1/referrals/labs/request",
        json=req_payload,
        headers={"Authorization": f"Bearer {patient_token}"}
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    request_id = data["id"]

    # 2. Partner retrieves incoming requests
    lab_token = create_access_token(subject=str(setup_data["lab_user"]), role="nurse", tenant_id=setup_data["partner_lab_id"])
    resp = await client.get(
        "/api/v1/referrals/labs/incoming",
        headers={"Authorization": f"Bearer {lab_token}"}
    )
    assert resp.status_code == 200
    incoming = resp.json()
    assert len(incoming) == 1
    assert incoming[0]["id"] == request_id

    # 3. Partner accepts request
    resp = await client.post(
        f"/api/v1/referrals/labs/{request_id}/action?action=accept",
        headers={"Authorization": f"Bearer {lab_token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
