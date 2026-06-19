"""
Integration test: Doctor registration, admin approval, and appointment booking.

Tests the full doctor lifecycle:
  1. Register a doctor profile (starts in pending_approval)
  2. Verify non-admin users cannot see pending doctors
  3. Admin approves the doctor
  4. Patient can now discover the active doctor
  5. Patient books an appointment
  6. Verify appointment appears in listing
"""

import pytest
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt
from app.config.settings import settings
from app.models.hospital import Hospital
from app.models.patient import Patient


def generate_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "token_version": 1,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def _make_hospital(owner_id: uuid.UUID, suffix: str = "") -> Hospital:
    """Helper: build a Hospital ORM object with all required fields."""
    return Hospital(
        name=f"Columbia Asia Bangalore{suffix}",
        registration_number=f"REG-COLUMBIA-BLR{suffix}",
        license_number=f"HOSP-COLUMBIA-BLR{suffix}",
        email=f"columbia.blr{suffix}@hospyn.com",
        phone="+919876543211",
        address_line1="Yeshwanthpur",
        city="Bangalore",
        state="Karnataka",
        pin_code="560022",
        owner_user_id=owner_id,
    )


@pytest.mark.asyncio
async def test_doctor_registration_approval_and_booking(client, db_session):
    # 1. Generate test tokens
    admin_id = str(uuid.uuid4())
    patient_user_id = str(uuid.uuid4())
    doctor_user_id = str(uuid.uuid4())

    admin_token = generate_token(admin_id, "admin")
    patient_token = generate_token(patient_user_id, "patient")
    doctor_token = generate_token(doctor_user_id, "doctor")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    doctor_headers = {"Authorization": f"Bearer {doctor_token}"}

    # 2. Setup Hospital in the database
    hospital = _make_hospital(owner_id=uuid.uuid4(), suffix="-doc")
    db_session.add(hospital)
    await db_session.flush()

    # 3. Create Patient directly in DB (needed for booking later)
    patient = Patient(
        user_id=uuid.UUID(patient_user_id),
        hospital_id=hospital.id,
        first_name="T Ravi",
        last_name="Teja",
        email="travi.doc@example.com",
        phone="+919876543210",
    )
    db_session.add(patient)
    await db_session.flush()

    # 4. Create Doctor Profile via API (starts in pending_approval)
    doctor_data = {
        "first_name": "Satish",
        "last_name": "Kumar",
        "email": "satish.kumar@hospyn.com",
        "phone": "+919876543212",
        "specialization": "Cardiology",
        "qualification": "MD Cardiology",
        "medical_license_number": "LIC-12345",
        "years_of_experience": 12,
        "consultation_fee": 50000,
        "bio": "Experienced cardiologist",
        "hospital_id": str(hospital.id),
    }

    response = await client.post(
        "/api/v1/healthcare/doctors/", json=doctor_data, headers=doctor_headers
    )
    assert response.status_code == 201, f"Create doctor failed: {response.text}"
    doctor_id = response.json()["data"]["id"]

    # 5. List active doctors as patient — should be empty (doctor is pending)
    response = await client.get("/api/v1/healthcare/doctors/", headers=patient_headers)
    assert response.status_code == 200
    assert len(response.json()["data"]["items"]) == 0

    # 6. Admin approves the doctor
    approve_data = {"status": "active"}
    response = await client.put(
        f"/api/v1/healthcare/doctors/{doctor_id}",
        json=approve_data,
        headers=admin_headers,
    )
    assert response.status_code == 200, f"Approve doctor failed: {response.text}"
    assert response.json()["data"]["status"] == "active"

    # 7. List active doctors as patient — should find the doctor now
    response = await client.get("/api/v1/healthcare/doctors/", headers=patient_headers)
    assert response.status_code == 200
    doctors = response.json()["data"]["items"]
    assert len(doctors) == 1
    assert doctors[0]["first_name"] == "Satish"

    # 8. Book an appointment with the approved doctor
    scheduled_time = (datetime.now(timezone.utc) + timedelta(days=1)).replace(
        microsecond=0
    )

    appointment_data = {
        "patient_id": str(patient.id),
        "doctor_id": doctor_id,
        "hospital_id": str(hospital.id),
        "scheduled_at": scheduled_time.isoformat(),
        "duration_minutes": 30,
        "appointment_type": "in_person",
        "chief_complaint": "Chest pain",
    }

    response = await client.post(
        "/api/v1/healthcare/appointments/",
        json=appointment_data,
        headers=patient_headers,
    )
    assert response.status_code == 201, f"Book appointment failed: {response.text}"
    apt_id = response.json()["data"]["id"]
    assert apt_id is not None

    # 9. List patient appointments
    response = await client.get(
        "/api/v1/healthcare/appointments/", headers=patient_headers
    )
    assert response.status_code == 200
    apts = response.json()["data"]["items"]
    assert len(apts) == 1
    assert apts[0]["id"] == apt_id
    assert apts[0]["chief_complaint"] == "Chest pain"
