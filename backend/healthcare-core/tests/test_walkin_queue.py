"""
Integration tests for the Walk-In Intake Queue System.

Tests the full walk-in queue pipeline:
1. Hospital Admin generates signed QR token.
2. Patient scans QR and submits intake form -> status: waiting_reception.
3. Duplicate check prevents spam.
4. Receptionist views queue and accepts patient -> routes to triage.
5. Nurse views triage queue, starts triage -> status: in_triage.
6. Nurse completes triage with vitals & notes -> routes to doctor.
7. Doctor views queue, starts consultation -> status: in_consultation (creates Appointment).
8. Doctor completes consultation with clinical notes -> status: completed.
"""

import pytest
import uuid
from jose import jwt

from app.config.settings import settings
from app.models.hospital import Hospital
from app.models.patient import Patient
from app.models.doctor import Doctor, DoctorStatus
from app.models.staff import Staff, StaffRole, ShiftStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.models.walkin import WalkInRequest
from app.services.queue_service import generate_walkin_token


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


@pytest.fixture
async def test_hospital(db_session):
    hospital = Hospital(
        name="Hospin General Hospital",
        registration_number="REG-HOSPIN-GEN",
        license_number="HOSP-HOSPIN-GEN",
        email="info@hospin.in",
        phone="+919876543210",
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
async def test_nurse(db_session, test_hospital):
    user_id = uuid.uuid4()
    nurse = Staff(
        user_id=user_id,
        hospital_id=test_hospital.id,
        first_name="Bob",
        last_name="Nurse",
        phone="+919000000002",
        role=StaffRole.nurse,
        is_active=True,
        shift_status=ShiftStatus.on_duty,
    )
    db_session.add(nurse)
    await db_session.flush()
    return nurse


@pytest.fixture
async def test_doctor(db_session, test_hospital):
    user_id = uuid.uuid4()
    doctor = Doctor(
        user_id=user_id,
        hospital_id=test_hospital.id,
        first_name="Carol",
        last_name="Doc",
        email="carol.doc@hospin.in",
        phone="+919000000003",
        specialization="General Medicine",
        qualification="MBBS, MD",
        medical_license_number="LIC-GEN-DOC",
        years_of_experience=8,
        consultation_fee=40000,
        status=DoctorStatus.active,
        is_active=True,
    )
    db_session.add(doctor)
    await db_session.flush()
    return doctor


@pytest.fixture
async def test_patient(db_session, test_hospital):
    patient_user_id = uuid.uuid4()
    patient = Patient(
        user_id=patient_user_id,
        hospital_id=test_hospital.id,
        first_name="John",
        last_name="Walkin",
        email="john.walkin@example.com",
        phone="+919999988888",
    )
    db_session.add(patient)
    await db_session.flush()
    return patient


@pytest.mark.asyncio
async def test_full_walkin_queue_pipeline(
    client,
    test_hospital,
    test_receptionist,
    test_nurse,
    test_doctor,
    test_patient,
    db_session,
):
    # Generate explicit tokens and headers for each role
    receptionist_token = generate_token(str(test_receptionist.user_id), "staff")
    nurse_token = generate_token(str(test_nurse.user_id), "staff")
    doctor_token = generate_token(str(test_doctor.user_id), "doctor")

    receptionist_headers = {"Authorization": f"Bearer {receptionist_token}"}
    nurse_headers = {"Authorization": f"Bearer {nurse_token}"}
    doctor_headers = {"Authorization": f"Bearer {doctor_token}"}

    # 1. Generate signed QR token for the hospital
    qr_token = generate_walkin_token(str(test_hospital.id))
    assert qr_token is not None

    # 2. Public intake form submission
    intake_data = {
        "first_name": "John",
        "last_name": "Walkin",
        "phone": "+919999988888",
        "age": 28,
        "gender": "male",
        "reason_for_visit": "Persistent headache and mild fever.",
        "symptoms": "Headache, low fever, fatigue",
        "is_emergency": False,
    }
    response = await client.post(
        f"/api/v1/healthcare/walkin/join/{qr_token}", json=intake_data
    )
    assert response.status_code == 201, f"Intake submission failed: {response.text}"
    res_json = response.json()
    assert res_json["success"] is True
    walkin_id = res_json["data"]["request_id"]
    assert walkin_id is not None
    assert res_json["data"]["queue_state"] == "waiting_reception"

    # Link the patient profile manually in DB for consultation later if needed
    # Note: Anonymous walk-ins have patient_id=None initially
    db_walkin = await db_session.get(WalkInRequest, uuid.UUID(walkin_id))
    db_walkin.patient_id = test_patient.id
    await db_session.flush()

    # 3. Duplicate check - try to join again with same details
    response_dup = await client.post(
        f"/api/v1/healthcare/walkin/join/{qr_token}", json=intake_data
    )
    assert response_dup.status_code == 409
    assert "active walk-in request" in response_dup.json()["message"]

    # 4. Patient checks their status
    status_response = await client.get(f"/api/v1/healthcare/walkin/status/{walkin_id}")
    assert status_response.status_code == 200
    assert status_response.json()["data"]["queue_state"] == "waiting_reception"

    # 5. Receptionist fetches the reception queue
    reception_queue_res = await client.get(
        "/api/v1/healthcare/reception/queue", headers=receptionist_headers
    )
    assert reception_queue_res.status_code == 200
    queue_data = reception_queue_res.json()["data"]
    assert queue_data["total_pending"] == 1
    assert queue_data["queue"][0]["id"] == walkin_id

    # 6. Receptionist accepts patient and routes to triage
    accept_payload = {"route_to": "triage"}
    accept_res = await client.patch(
        f"/api/v1/healthcare/reception/queue/{walkin_id}/accept",
        json=accept_payload,
        headers=receptionist_headers,
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["data"]["new_state"] == "waiting_triage"

    # 7. Nurse fetches triage queue
    nurse_queue_res = await client.get(
        "/api/v1/healthcare/nurse/queue", headers=nurse_headers
    )
    assert nurse_queue_res.status_code == 200
    nurse_queue = nurse_queue_res.json()["data"]
    assert nurse_queue["total_pending"] == 1
    assert nurse_queue["queue"][0]["id"] == walkin_id

    # 8. Nurse starts triage
    start_triage_res = await client.patch(
        f"/api/v1/healthcare/nurse/queue/{walkin_id}/start", headers=nurse_headers
    )
    assert start_triage_res.status_code == 200
    assert start_triage_res.json()["data"]["new_state"] == "in_triage"

    # 9. Nurse completes triage, submits vitals and routes to doctor
    triage_payload = {
        "triage_notes": "Patient complains of severe migraine. Checked vitals.",
        "vitals": {
            "systolic": 120,
            "diastolic": 80,
            "pulse": 72,
            "temperature": 98.6,
            "spo2": 99,
        },
        "assigned_doctor_id": str(test_doctor.id),
        "priority_override": "normal",
    }
    complete_triage_res = await client.patch(
        f"/api/v1/healthcare/nurse/queue/{walkin_id}/complete",
        json=triage_payload,
        headers=nurse_headers,
    )
    assert complete_triage_res.status_code == 200
    assert complete_triage_res.json()["data"]["new_state"] == "waiting_doctor"

    # 10. Doctor views queue
    doctor_queue_res = await client.get(
        "/api/v1/healthcare/doctor/queue", headers=doctor_headers
    )
    assert doctor_queue_res.status_code == 200
    doc_queue = doctor_queue_res.json()["data"]
    assert doc_queue["total_waiting"] == 1
    assert doc_queue["queue"][0]["id"] == walkin_id

    # 11. Doctor starts consultation (creates Appointment record)
    start_consult_res = await client.patch(
        f"/api/v1/healthcare/doctor/queue/{walkin_id}/start", headers=doctor_headers
    )
    assert start_consult_res.status_code == 200
    consult_data = start_consult_res.json()["data"]
    assert consult_data["new_state"] == "in_consultation"
    appointment_id = consult_data["appointment_id"]
    assert appointment_id is not None

    # 12. Doctor completes consultation
    consult_complete_payload = {
        "chief_complaint": "Migraine headache.",
        "clinical_notes": "Prescribed rest and hydration.",
        "diagnosis": "Tension Migraine",
        "prescription": "Paracetamol 650mg TDS x 3 days",
    }
    complete_consult_res = await client.patch(
        f"/api/v1/healthcare/doctor/queue/{walkin_id}/complete",
        json=consult_complete_payload,
        headers=doctor_headers,
    )
    assert complete_consult_res.status_code == 200
    assert complete_consult_res.json()["data"]["new_state"] == "completed"

    # 13. Verify appointment status is completed in database
    db_appointment = await db_session.get(Appointment, uuid.UUID(appointment_id))
    assert db_appointment.status == AppointmentStatus.completed
    assert db_appointment.diagnosis == "Tension Migraine"
