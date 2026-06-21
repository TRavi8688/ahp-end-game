import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient
import uuid
from datetime import datetime

from app.main import app
from app.models.models import Base, User, Hospital, Patient, FamilyMember, PatientVisit, MedicalRecord, DigitalPrescription, LabDiagnosticOrder, LabResult, RoleEnum, RecordTypeEnum, VisitStatusEnum, PrescriptionStatusEnum, LabOrderStatusEnum
from app.core.security import get_password_hash, create_access_token
from app.core.database import get_db

# Use in-memory SQLite for testing to ensure clean state
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
async def setup_clinical_data():
    async with TestingSessionLocal() as session:
        # Create Hospital
        hosp = Hospital(name="Apex Medical Center", registration_number="APEX-99", version_id=1, hospyn_id="Hospyn-APEX", short_code="APEX")
        session.add(hosp)
        await session.flush()

        # Create Patient User
        user = User(email="patient@example.com", hashed_password=get_password_hash("password"), role=RoleEnum.patient, token_version=1, first_name="John", last_name="Doe")
        session.add(user)
        await session.flush()

        # Create Patient Profile
        patient = Patient(user_id=user.id, hospyn_id="HP-12345", phone_number="1234567890")
        session.add(patient)
        await session.flush()

        # Create Family Member Profile
        fm = FamilyMember(patient_id=patient.id, full_name="Jane Doe", relation="Spouse")
        session.add(fm)
        await session.flush()

        # 1. Main Patient Visit
        visit = PatientVisit(
            patient_id=patient.id,
            hospital_id=hosp.id,
            visit_reason="Persistent cough",
            symptoms="Dry cough, low fever",
            department="Pulmonology",
            doctor_name="Dr. Smith",
            status=VisitStatusEnum.active
        )
        session.add(visit)
        await session.flush()

        # 2. Main Patient Prescription for Visit
        presc = DigitalPrescription(
            hospital_id=hosp.id,
            doctor_id=uuid.uuid4(),
            patient_id=patient.id,
            visit_id=visit.id,
            status=PrescriptionStatusEnum.fulfilled,
            diagnosis="Bronchitis",
            medications={"meds": [{"name": "Cough Syrup", "dosage": "10ml"}]},
            notes="Drink plenty of warm water"
        )
        session.add(presc)
        await session.flush()

        # 3. Main Patient Lab Order for Visit
        lab_order = LabDiagnosticOrder(
            hospital_id=hosp.id,
            doctor_id=uuid.uuid4(),
            patient_id=patient.id,
            visit_id=visit.id,
            status=LabOrderStatusEnum.completed,
            tests={"tests": [{"test_id": "cbc", "test_name": "Complete Blood Count"}]}
        )
        session.add(lab_order)
        await session.flush()

        lab_result = LabResult(
            hospital_id=hosp.id,
            order_id=lab_order.id,
            patient_id=patient.id,
            test_name="Hemoglobin",
            value="11.5",
            unit="g/dL",
            reference_range="12.0-16.0",
            is_abnormal=True
        )
        session.add(lab_result)
        await session.flush()

        # 4. Main Patient Medical Record (PDF report) for Visit
        rec = MedicalRecord(
            patient_id=patient.id,
            type=RecordTypeEnum.document,
            file_url="https://bucket.s3.amazonaws.com/reports/johndoe_cbc.pdf",
            visit_id=visit.id,
            record_name="CBC Lab Report",
            hospital_name="Apex Labs",
            patient_summary="Low hemoglobin detected",
            needs_verification=False
        )
        session.add(rec)
        await session.flush()

        # 5. Standalone Medical Record for Main Patient
        standalone_rec = MedicalRecord(
            patient_id=patient.id,
            type=RecordTypeEnum.prescription,
            file_url="https://bucket.s3.amazonaws.com/uploads/old_prescription.jpg",
            record_name="Old Dermatologist Prescription",
            hospital_name="Skin Care Clinic",
            patient_summary="Dermatology prescription upload"
        )
        session.add(standalone_rec)
        await session.flush()

        # 6. Family Member Visit
        fm_visit = PatientVisit(
            patient_id=patient.id,
            hospital_id=hosp.id,
            family_member_id=fm.id,
            visit_reason="Routine checkup",
            symptoms="None",
            department="General",
            doctor_name="Dr. Taylor",
            status=VisitStatusEnum.completed
        )
        session.add(fm_visit)
        await session.flush()

        # 7. Family Member Prescription for Visit
        fm_presc = DigitalPrescription(
            hospital_id=hosp.id,
            doctor_id=uuid.uuid4(),
            patient_id=patient.id,
            family_member_id=fm.id,
            visit_id=fm_visit.id,
            status=PrescriptionStatusEnum.pending,
            diagnosis="Healthy",
            medications={"meds": [{"name": "Multivitamins", "dosage": "1 daily"}]},
            notes="Keep active"
        )
        session.add(fm_presc)
        await session.flush()

        await session.commit()

        return {
            "user_id": user.id,
            "patient_id": patient.id,
            "family_member_id": fm.id,
            "visit_id": visit.id,
            "fm_visit_id": fm_visit.id
        }

@pytest.mark.asyncio
async def test_patient_timeline_retrieval(client, setup_clinical_data):
    token = create_access_token(setup_clinical_data["user_id"], role=RoleEnum.patient.value)

    # Fetch main patient's timeline (no family member header)
    response = await client.get("/api/v1/patient/timeline", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    timeline = response.json()

    # Timeline should have 2 top-level items: the main patient's visit and the standalone medical record
    # Wait, the family member visit should NOT appear since no family member context was provided.
    assert len(timeline) == 2

    # Check the visit item
    visit_item = next(item for item in timeline if item["type"] == "visit")
    assert visit_item["visit_reason"] == "Persistent cough"
    assert visit_item["doctor_name"] == "Dr. Smith"
    assert len(visit_item["prescriptions"]) == 1
    assert len(visit_item["lab_orders"]) == 1
    assert len(visit_item["records"]) == 1

    # Verify nested details
    assert visit_item["prescriptions"][0]["diagnosis"] == "Bronchitis"
    assert visit_item["lab_orders"][0]["results"][0]["test_name"] == "Hemoglobin"
    assert visit_item["lab_orders"][0]["results"][0]["is_abnormal"] is True
    assert visit_item["records"][0]["record_name"] == "CBC Lab Report"

    # Check standalone item
    standalone_item = next(item for item in timeline if item["type"] == "standalone_record")
    assert standalone_item["record_name"] == "Old Dermatologist Prescription"
    assert standalone_item["hospital_name"] == "Skin Care Clinic"

@pytest.mark.asyncio
async def test_patient_timeline_family_member(client, setup_clinical_data):
    token = create_access_token(setup_clinical_data["user_id"], role=RoleEnum.patient.value)

    # Fetch family member's timeline
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Family-Member-ID": str(setup_clinical_data["family_member_id"])
    }
    response = await client.get("/api/v1/patient/timeline", headers=headers)
    assert response.status_code == 200
    timeline = response.json()

    # Timeline should only contain the family member's visit
    assert len(timeline) == 1
    fm_visit = timeline[0]
    assert fm_visit["type"] == "visit"
    assert fm_visit["visit_reason"] == "Routine checkup"
    assert fm_visit["doctor_name"] == "Dr. Taylor"
    assert len(fm_visit["prescriptions"]) == 1
    assert fm_visit["prescriptions"][0]["diagnosis"] == "Healthy"
