"""
Integration test: Patient onboarding, profile creation, file upload, and record retrieval.

Tests the full patient lifecycle:
  1. Create a patient profile via API
  2. Fetch the profile via /me
  3. Upload a mock medical report
  4. Confirm and save the report
  5. Retrieve saved records
  6. Verify clinical timeline includes the record
"""

import pytest
import uuid
from jose import jwt
from app.config.settings import settings
from app.models.hospital import Hospital


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
        name=f"Apollo Hospital Chennai{suffix}",
        registration_number=f"REG-APOLLO-CHE{suffix}",
        license_number=f"HOSP-APOLLO-CHE{suffix}",
        email=f"apollo.che{suffix}@hospyn.com",
        phone="+919876543210",
        address_line1="Greams Road",
        city="Chennai",
        state="Tamil Nadu",
        pin_code="600006",
        owner_user_id=owner_id,
    )


@pytest.mark.asyncio
async def test_patient_onboarding_and_uploads(client, db_session):
    # 1. Generate test tokens
    user_id = str(uuid.uuid4())
    patient_token = generate_token(user_id, "patient")
    headers = {"Authorization": f"Bearer {patient_token}"}

    # 2. Add a test hospital to the DB (directly via ORM)
    hospital = _make_hospital(owner_id=uuid.uuid4())
    db_session.add(hospital)
    await db_session.flush()

    # 3. Create a patient profile via API
    patient_data = {
        "first_name": "T Ravi",
        "last_name": "Teja",
        "phone": "+919876543210",
        "email": "travi.teja@example.com",
        "hospital_id": str(hospital.id),
    }

    response = await client.post(
        "/api/v1/healthcare/patients/", json=patient_data, headers=headers
    )
    assert response.status_code == 201, f"Create patient failed: {response.text}"
    assert response.json()["data"]["first_name"] == "T Ravi"

    # 4. Fetch the patient profile via /me
    response = await client.get("/api/v1/healthcare/patients/me", headers=headers)
    assert response.status_code == 200, f"Get /me failed: {response.text}"
    assert response.json()["data"]["first_name"] == "T Ravi"

    # 5. Upload a mock report (simulated PDF)
    file_content = b"%PDF-1.4 mock pdf contents here"
    files = {"file": ("my_medical_prescription.pdf", file_content, "application/pdf")}

    response = await client.post(
        "/api/v1/healthcare/patients/upload-report", files=files, headers=headers
    )
    assert response.status_code == 200, f"Upload report failed: {response.text}"
    res_data = response.json()
    assert res_data["status"] == "success"
    assert res_data["type"] == "prescription"

    # 6. Confirm and save the report
    confirm_payload = {
        "analysis": {
            "structured_data": res_data["extracted_data"],
            "summary": res_data["summary"],
            "raw_text": res_data["visual_findings"],
        },
        "record_name": res_data["record_name"],
        "hospital_name": res_data["hospital_name"],
        "s3_url": res_data["url"],
        "type": res_data["type"],
        "update_profile": True,
    }

    response = await client.post(
        "/api/v1/healthcare/patients/confirm-and-save-report",
        json=confirm_payload,
        headers=headers,
    )
    assert response.status_code == 200, f"Confirm-save failed: {response.text}"
    record_id = response.json()["record_id"]
    assert record_id is not None

    # 7. Check patient profile was updated with conditions
    response = await client.get("/api/v1/healthcare/patients/me", headers=headers)
    assert response.status_code == 200
    profile_data = response.json()["data"]
    assert "Allergic Rhinitis" in (profile_data.get("chronic_conditions") or "")

    # 8. Retrieve the uploaded records
    response = await client.get("/api/v1/healthcare/patients/records", headers=headers)
    assert response.status_code == 200
    records = response.json()
    assert len(records) > 0
    assert records[0]["id"] == record_id

    # 9. Retrieve the unified clinical timeline
    response = await client.get("/api/v1/healthcare/clinical/timeline", headers=headers)
    assert response.status_code == 200
    timeline = response.json()
    assert len(timeline) > 0
    assert timeline[0]["type"] == "standalone_record"
