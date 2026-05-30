import pytest
import uuid
from jose import jwt
from httpx import AsyncClient

from app.config.settings import settings
from app.models.hospital import Hospital
from app.models.patient import Patient
from app.models.doctor import Doctor, DoctorStatus
from app.models.staff import Staff, StaffRole, ShiftStatus
from app.models.walkin import WalkInRequest, QueueState, PriorityLevel, WalkInSource
from app.services.routing_service import QueueRoutingService

def generate_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "token_version": 1,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

@pytest.fixture
async def test_hospital(db_session):
    hospital = Hospital(
        name="Test Advanced Hospital",
        registration_number="REG-ADV-1",
        license_number="LIC-ADV-1",
        email="adv@hospyn.com",
        phone="+919876543211",
        address_line1="Outer Ring Road",
        city="Bangalore",
        state="Karnataka",
        pin_code="560103",
        owner_user_id=uuid.uuid4(),
    )
    db_session.add(hospital)
    await db_session.flush()
    return hospital

@pytest.fixture
async def test_receptionist(db_session, test_hospital):
    user_id = uuid.uuid4()
    receptionist = Staff(
        user_id=user_id,
        hospital_id=test_hospital.id,
        first_name="Alice",
        last_name="Reception",
        phone="+919000000001",
        role=StaffRole.receptionist,
        is_active=True,
        shift_status=ShiftStatus.on_duty,
    )
    db_session.add(receptionist)
    await db_session.flush()
    return receptionist

@pytest.fixture
async def test_doctor_1(db_session, test_hospital):
    user_id = uuid.uuid4()
    doctor = Doctor(
        user_id=user_id,
        hospital_id=test_hospital.id,
        first_name="John",
        last_name="Primary",
        email="john.doc1@hospyn.com",
        specialization="General Physician",
        medical_license_number="LIC-DOC-1",
        consultation_fee=50000,
        status=DoctorStatus.active,
        is_active=True,
        years_of_experience=10
    )
    db_session.add(doctor)
    await db_session.flush()
    return doctor

@pytest.fixture
async def test_doctor_2(db_session, test_hospital):
    user_id = uuid.uuid4()
    doctor = Doctor(
        user_id=user_id,
        hospital_id=test_hospital.id,
        first_name="Sarah",
        last_name="Secondary",
        email="sarah.doc2@hospyn.com",
        specialization="General Physician",
        medical_license_number="LIC-DOC-2",
        consultation_fee=50000,
        status=DoctorStatus.active,
        is_active=True,
        years_of_experience=5
    )
    db_session.add(doctor)
    await db_session.flush()
    return doctor


@pytest.mark.asyncio
async def test_reception_advanced_flows(
    client: AsyncClient, db_session, test_hospital, test_receptionist, test_doctor_1, test_doctor_2
):
    token = generate_token(str(test_receptionist.user_id), "staff")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test QR Token Generator Endpoint
    res = await client.get("/api/v1/healthcare/reception/qr-token", headers=headers)
    assert res.status_code == 200
    assert "token" in res.json()["data"]

    # 2. Test Manual Check-in Journey
    payload = {
        "first_name": "Testy",
        "last_name": "Patient",
        "phone": "+918888888888",
        "age": 30,
        "gender": "Male",
        "reason_for_visit": "Fever and headaches",
        "priority_level": "normal"
    }
    res = await client.post("/api/v1/healthcare/reception/queue/manual", json=payload, headers=headers)
    assert res.status_code == 201
    walkin_id = res.json()["data"]["request_id"]
    assert walkin_id is not None

    # 3. Test Double Check-in (Duplicate Prevention Check)
    res = await client.post("/api/v1/healthcare/reception/queue/manual", json=payload, headers=headers)
    assert res.status_code == 400  # ValueError maps to 400 from ReceptionService duplicate checks

    # 4. Routing Engine workload suggest suggestion test
    # Doctor 1 has no workload. Doctor 2 has no workload, but Doc 1 has 10 years experience vs Doc 2's 5.
    doc = await QueueRoutingService.suggest_doctor(db_session, test_hospital.id, specialization="General Physician")
    assert doc.id == test_doctor_1.id  # Sorted by higher experience since loads are equal (0)

    # 5. Search patient lookup test
    # Seed patient
    patient = Patient(
        user_id=uuid.uuid4(),
        hospital_id=test_hospital.id,
        first_name="Testy",
        last_name="Patient",
        phone="+918888888888",
        email="testy@patient.com",
        is_active=True
    )
    db_session.add(patient)
    await db_session.flush()

    res = await client.get("/api/v1/healthcare/reception/patients/search?q=Testy", headers=headers)
    assert res.status_code == 200
    assert len(res.json()["data"]) > 0
    assert res.json()["data"][0]["phone"] == "+918888888888"

    # 6. Test OP Billing payment collection flow
    res = await client.patch(
        f"/api/v1/healthcare/reception/queue/{walkin_id}/pay",
        json={"payment_method": "upi", "transaction_reference": "TXN_OK_123"},
        headers=headers
    )
    assert res.status_code == 200
    assert res.json()["data"]["billing_status"] == "paid"

    # 7. Test Routing walk-in acceptance to doctor
    res = await client.patch(
        f"/api/v1/healthcare/reception/queue/{walkin_id}/accept",
        json={"route_to": "doctor", "assigned_doctor_id": str(test_doctor_1.id)},
        headers=headers
    )
    assert res.status_code == 200
    assert res.json()["data"]["new_state"] == QueueState.waiting_doctor.value

    # 8. Test Doctor Starts Consultation
    doc_token = generate_token(str(test_doctor_1.user_id), "doctor")
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    
    res = await client.patch(
        f"/api/v1/healthcare/doctor/queue/{walkin_id}/start",
        headers=doc_headers
    )
    assert res.status_code == 200
    assert res.json()["data"]["new_state"] == QueueState.in_consultation.value

    # 9. Test Doctor Completes Consultation with E-Prescription
    consult_payload = {
        "diagnosis": "Viral Fever",
        "clinical_notes": "Patient advised rest for 3 days.",
        "prescription_items": [
            {
                "drug_name": "Paracetamol",
                "dosage": "500mg",
                "frequency": "1-1-1",
                "duration": "3 days",
                "instructions": "After meals"
            }
        ]
    }
    res = await client.patch(
        f"/api/v1/healthcare/doctor/queue/{walkin_id}/complete",
        json=consult_payload,
        headers=doc_headers
    )
    assert res.status_code == 200
    assert res.json()["data"]["new_state"] == QueueState.completed.value
