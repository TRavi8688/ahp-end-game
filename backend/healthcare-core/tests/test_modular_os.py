import pytest
import uuid
from jose import jwt

from app.config.settings import settings
from app.models.hospital import Hospital
from app.models.staff import Staff, StaffRole, ShiftStatus
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
    owner_id = uuid.uuid4()
    hospital = Hospital(
        name="Modular Test Hospital",
        registration_number="REG-MODULAR-TEST",
        license_number="HOSP-MODULAR-TEST",
        email="owner@test.com",
        phone="+919876543211",
        address_line1="Outer Ring Road",
        city="Bangalore",
        state="Karnataka",
        pin_code="560103",
        owner_user_id=owner_id,
        enabled_modules=["reception", "nurse", "doctor", "pharmacy", "laboratory", "billing", "ward", "admin"]
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
async def test_pharmacist(db_session, test_hospital):
    user_id = uuid.uuid4()
    pharmacist = Staff(
        user_id=user_id,
        hospital_id=test_hospital.id,
        first_name="Phil",
        last_name="Pharmacy",
        phone="+919000000004",
        role=StaffRole.pharmacist,
        is_active=True,
        shift_status=ShiftStatus.on_duty,
    )
    db_session.add(pharmacist)
    await db_session.flush()
    return pharmacist

@pytest.mark.asyncio
async def test_modular_os_guards_and_transitions(
    client,
    test_hospital,
    test_receptionist,
    test_nurse,
    test_pharmacist,
    db_session,
):
    # Tokens
    owner_token = generate_token(str(test_hospital.owner_user_id), "owner")
    receptionist_token = generate_token(str(test_receptionist.user_id), "staff")
    nurse_token = generate_token(str(test_nurse.user_id), "staff")
    pharmacist_token = generate_token(str(test_pharmacist.user_id), "pharmacist")

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    receptionist_headers = {"Authorization": f"Bearer {receptionist_token}"}
    nurse_headers = {"Authorization": f"Bearer {nurse_token}"}
    pharmacist_headers = {"Authorization": f"Bearer {pharmacist_token}"}

    # 1. Fetch modules (initially all enabled)
    res = await client.get("/api/v1/healthcare/owner/modules", headers=owner_headers)
    assert res.status_code == 200
    assert "reception" in res.json()["data"]["enabled_modules"]

    # 2. Disable Nurse & Pharmacy & Billing
    update_res = await client.put(
        "/api/v1/healthcare/owner/modules",
        json={"enabled_modules": ["reception", "doctor", "laboratory", "ward", "admin"]},
        headers=owner_headers
    )
    assert update_res.status_code == 200
    assert "nurse" not in update_res.json()["data"]["enabled_modules"]

    # 3. Create a walk-in patient request
    qr_token = generate_walkin_token(str(test_hospital.id))
    intake_data = {
        "first_name": "Modular",
        "last_name": "Patient",
        "phone": "9876543219",
        "age": 30,
        "gender": "male",
        "reason_for_visit": "Need routing test",
        "is_emergency": False,
    }
    join_res = await client.post(
        f"/api/v1/healthcare/walkin/join/{qr_token}", json=intake_data
    )
    assert join_res.status_code == 201
    walkin_id = join_res.json()["data"]["request_id"]

    # 4. Receptionist accepts patient. Since "nurse" module is disabled, routing to "triage"
    # should be auto-coerced to "doctor" (skipping nurse triage queue).
    accept_payload = {
        "route_to": "triage",
        "assigned_doctor_id": str(uuid.uuid4()) # mock doctor ID
    }
    accept_res = await client.patch(
        f"/api/v1/healthcare/reception/queue/{walkin_id}/accept",
        json=accept_payload,
        headers=receptionist_headers
    )
    assert accept_res.status_code == 200
    # Assert that the new_state is waiting_doctor, not waiting_triage
    assert accept_res.json()["data"]["new_state"] == "waiting_doctor"

    # 5. Accessing nurse triage queue when disabled should raise 403 Forbidden
    nurse_res = await client.get("/api/v1/healthcare/nurse/queue", headers=nurse_headers)
    assert nurse_res.status_code == 403
    assert "Nurse triage module is not enabled" in nurse_res.json()["detail"]

    # 6. Accessing billing routes when disabled should raise 403 Forbidden
    billing_res = await client.get("/api/v1/healthcare/billing/hospital/invoices", headers=receptionist_headers)
    assert billing_res.status_code == 403
    assert "Billing module is not enabled" in billing_res.json()["detail"]

    # 7. Accessing pharmacy routes when disabled should raise 403 Forbidden
    pharmacy_res = await client.get("/api/v1/healthcare/pharmacy/inventory", headers=pharmacist_headers)
    assert pharmacy_res.status_code == 403
    assert "Pharmacy module is not enabled" in pharmacy_res.json()["detail"]
