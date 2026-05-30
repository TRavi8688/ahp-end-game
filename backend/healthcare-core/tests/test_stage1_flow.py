"""
Integration test: Stage 1 Patient and Doctor flow.
"""
import pytest
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt
from httpx import AsyncClient

from app.config.settings import settings
from app.models.hospital import Hospital
from app.models.patient import Patient
from app.models.doctor import Doctor, DoctorStatus
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType


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
        name="Apollo Chennai Stage 1",
        registration_number="REG-APOLLO-S1",
        license_number="HOSP-APOLLO-S1",
        email="apollo.s1@hospyn.com",
        phone="+919876543210",
        address_line1="Greams Road",
        city="Chennai",
        state="Tamil Nadu",
        pin_code="600006",
        owner_user_id=uuid.uuid4(),
    )
    db_session.add(hospital)
    await db_session.flush()
    return hospital


@pytest.fixture
async def test_patient(db_session, test_hospital):
    patient_user_id = uuid.uuid4()
    patient = Patient(
        user_id=patient_user_id,
        hospital_id=test_hospital.id,
        first_name="John",
        last_name="Doe",
        email="john.doe@example.com",
        phone="+919876543210",
    )
    db_session.add(patient)
    await db_session.flush()
    return patient


@pytest.fixture
async def client_patient(client, test_patient):
    token = generate_token(str(test_patient.user_id), "patient")
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
async def active_doctor(db_session, test_hospital):
    doctor_user_id = uuid.uuid4()
    doctor = Doctor(
        user_id=doctor_user_id,
        hospital_id=test_hospital.id,
        first_name="Jane",
        last_name="Smith",
        email="jane.smith@hospyn.com",
        phone="+919876543212",
        specialization="Cardiology",
        qualification="MD",
        medical_license_number="LIC-S1-DOC",
        years_of_experience=10,
        consultation_fee=50000,
        status=DoctorStatus.active,
        is_active=True,
    )
    db_session.add(doctor)
    await db_session.flush()
    return doctor


@pytest.fixture
async def client_doctor(client, active_doctor):
    token = generate_token(str(active_doctor.user_id), "doctor")
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
async def test_appointment(db_session, test_hospital, test_patient, active_doctor):
    scheduled_time = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0)
    appointment = Appointment(
        patient_id=test_patient.id,
        doctor_id=active_doctor.id,
        hospital_id=test_hospital.id,
        scheduled_at=scheduled_time,
        duration_minutes=30,
        appointment_type=AppointmentType.in_person,
        chief_complaint="Routine checkup",
        status=AppointmentStatus.scheduled,
    )
    db_session.add(appointment)
    await db_session.flush()
    return appointment


@pytest.mark.asyncio
async def test_search_doctors(client_patient: AsyncClient, active_doctor):
    """Test that a patient can search for an active doctor."""
    response = await client_patient.get("/api/v1/healthcare/patients/search-doctors")
    assert response.status_code == 200, f"Search doctors failed: {response.text}"
    data = response.json()["data"]
    assert "items" in data
    # Check if the created doctor is in the list
    doctor_ids = [doc["id"] for doc in data["items"]]
    assert str(active_doctor.id) in doctor_ids


@pytest.mark.asyncio
async def test_update_clinical_notes(client_doctor: AsyncClient, test_appointment):
    """Test that a doctor can update clinical notes using PATCH."""
    payload = {
        "clinical_notes": "Patient presents with mild fever.",
        "diagnosis": "Viral Infection",
        "prescription": "Paracetamol 500mg"
    }
    response = await client_doctor.patch(
        f"/api/v1/healthcare/appointments/{test_appointment.id}/clinical-notes",
        json=payload
    )
    assert response.status_code == 200, f"Update clinical notes failed: {response.text}"
    data = response.json()["data"]
    assert data["clinical_notes"] == "Patient presents with mild fever."
    assert data["diagnosis"] == "Viral Infection"
    assert data["prescription"] == "Paracetamol 500mg"


@pytest.mark.asyncio
async def test_doctor_get_patient_medical_records(client_doctor: AsyncClient, test_appointment, test_patient):
    """Test that a doctor can view medical records of a patient they have an appointment with."""
    response = await client_doctor.get(
        f"/api/v1/healthcare/doctors/patients/{test_patient.id}/medical-records"
    )
    assert response.status_code == 200, f"Get medical records failed: {response.text}"
    data = response.json()["data"]
    assert isinstance(data, list)
