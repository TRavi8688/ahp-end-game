"""
Integration test for Phase 2 Consent Token Booking Flow.
"""

import pytest
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt
from app.config.settings import settings
from app.models.hospital import Hospital
from app.models.patient import Patient
from app.models.doctor import Doctor, DoctorStatus


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


def _make_hospital(owner_id: uuid.UUID) -> Hospital:
    return Hospital(
        name="Columbia Asia Bangalore Consent",
        registration_number="REG-COLUMBIA-CONSENT",
        license_number="HOSP-COLUMBIA-CONSENT",
        email="columbia.consent@hospin.in",
        phone="+919876543211",
        address_line1="Yeshwanthpur",
        city="Bangalore",
        state="Karnataka",
        pin_code="560022",
        owner_user_id=owner_id,
    )


@pytest.mark.asyncio
async def test_doctor_booking_consent_flow(client, db_session):
    # 1. Generate tokens
    patient_user_id = str(uuid.uuid4())
    doctor_user_id = str(uuid.uuid4())

    patient_token = generate_token(patient_user_id, "patient")
    doctor_token = generate_token(doctor_user_id, "doctor")

    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    doctor_headers = {"Authorization": f"Bearer {doctor_token}"}

    # 2. Setup Hospital, Patient and Doctor
    hospital = _make_hospital(owner_id=uuid.uuid4())
    db_session.add(hospital)
    await db_session.flush()

    patient = Patient(
        user_id=uuid.UUID(patient_user_id),
        hospital_id=hospital.id,
        first_name="Consent",
        last_name="Patient",
        email="consent.patient@example.com",
        phone="+919876543210",
    )
    db_session.add(patient)

    doctor = Doctor(
        user_id=uuid.UUID(doctor_user_id),
        hospital_id=hospital.id,
        first_name="Consent",
        last_name="Doctor",
        email="consent.doctor@hospin.in",
        phone="+919876543212",
        specialization="General Medicine",
        qualification="MBBS",
        medical_license_number="LIC-CONSENT",
        years_of_experience=5,
        consultation_fee=30000,
        status=DoctorStatus.active,
        is_active=True,
    )
    db_session.add(doctor)
    await db_session.flush()

    # 3. Doctor tries to book WITHOUT consent token -> MUST FAIL (403)
    booking_data = {
        "patient_id": str(patient.id),
        "doctor_id": str(doctor.id),
        "hospital_id": str(hospital.id),
        "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "duration_minutes": 30,
        "appointment_type": "in_person",
        "chief_complaint": "Routine checkup without consent token test",
    }

    response = await client.post(
        "/api/v1/healthcare/appointments/", json=booking_data, headers=doctor_headers
    )
    assert response.status_code == 403
    assert "consent token is required" in response.json()["message"]

    # 4. Patient generates a consent token via the new endpoint
    consent_response = await client.post(
        "/api/v1/healthcare/patients/booking-consent", headers=patient_headers
    )
    assert consent_response.status_code == 200
    consent_token = consent_response.json()["data"]["consent_token"]
    assert consent_token is not None

    # 5. Doctor tries to book WITH an invalid consent token -> MUST FAIL (403)
    booking_data["patient_consent_token"] = "invalid_token_123"
    response = await client.post(
        "/api/v1/healthcare/appointments/", json=booking_data, headers=doctor_headers
    )
    assert response.status_code == 403
    assert (
        "Invalid or expired patient booking consent token" in response.json()["message"]
    )

    # 6. Doctor tries to book WITH the VALID consent token -> MUST SUCCEED (201)
    booking_data["patient_consent_token"] = consent_token
    response = await client.post(
        "/api/v1/healthcare/appointments/", json=booking_data, headers=doctor_headers
    )
    assert response.status_code == 201, f"Booking with consent failed: {response.text}"
    assert response.json()["data"]["status"] == "scheduled"
