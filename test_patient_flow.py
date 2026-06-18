"""
backend/healthcare-core/tests/test_patient_flow.py

Integration tests for the core clinical flows:
  - Patient CRUD
  - Multi-tenant isolation (hospital A cannot see hospital B's data)
  - Appointment booking and conflict detection
  - Billing invoice creation
  - Auth enforcement (401/403 checks)
"""
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Patient management
# ---------------------------------------------------------------------------

class TestPatientManagement:
    @pytest.mark.asyncio
    async def test_create_patient(
        self, client: AsyncClient, auth_headers_hospital_admin: dict, test_hospital: dict
    ):
        """POST /api/v1/patients → 201 with patient data echoed back."""
        payload = {
            "name": "New Test Patient",
            "phone": "+919200000001",
            "date_of_birth": "1995-03-22",
            "gender": "female",
            "hospital_id": test_hospital["id"],
        }
        resp = await client.post(
            "/api/v1/patients",
            json=payload,
            headers=auth_headers_hospital_admin,
        )
        assert resp.status_code == 201, (
            f"Expected 201, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert data["name"] == payload["name"]
        assert data["phone"] == payload["phone"]
        assert "id" in data, "Response must include the created patient's id"

    @pytest.mark.asyncio
    async def test_unauthorized_access_to_patient_data(self, client: AsyncClient):
        """GET /api/v1/patients without any token → 401."""
        resp = await client.get("/api/v1/patients")
        assert resp.status_code == 401, (
            f"Unauthenticated request should return 401, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_patient_isolation(
        self,
        client: AsyncClient,
        hospital_a_headers: dict,
        test_patient_b: dict,
    ):
        """
        Hospital A's admin tries to GET a patient belonging to Hospital B → 403.
        This is the core multi-tenant isolation guarantee.
        """
        resp = await client.get(
            f"/api/v1/patients/{test_patient_b['id']}",
            headers=hospital_a_headers,
        )
        assert resp.status_code == 403, (
            f"Hospital A should not access Hospital B's patient. "
            f"Got {resp.status_code}: {resp.text}"
        )

    @pytest.mark.asyncio
    async def test_patient_cannot_access_other_patient(
        self,
        client: AsyncClient,
        patient_a_headers: dict,
        test_patient_b: dict,
    ):
        """
        Patient A tries to GET patient B's record → 403.
        Patients may only read their own data.
        """
        resp = await client.get(
            f"/api/v1/patients/{test_patient_b['id']}",
            headers=patient_a_headers,
        )
        assert resp.status_code == 403, (
            f"Patient should not access another patient's record. "
            f"Got {resp.status_code}: {resp.text}"
        )

    @pytest.mark.asyncio
    async def test_list_patients_returns_only_own_hospital(
        self,
        client: AsyncClient,
        hospital_a_headers: dict,
        test_patient: dict,
        test_patient_b: dict,
    ):
        """
        Listing patients must only return patients from the admin's own hospital.
        Hospital B's patient must NOT appear in Hospital A's list.
        """
        resp = await client.get(
            "/api/v1/patients",
            headers=hospital_a_headers,
        )
        assert resp.status_code == 200
        patient_ids = [p["id"] for p in resp.json().get("items", resp.json())]
        assert test_patient["id"] in patient_ids, "Own patient should be in list"
        assert test_patient_b["id"] not in patient_ids, (
            "Cross-hospital patient must NOT appear in listing"
        )


# ---------------------------------------------------------------------------
# Appointment booking
# ---------------------------------------------------------------------------

class TestAppointmentBooking:
    @pytest.mark.asyncio
    async def test_book_appointment(
        self,
        client: AsyncClient,
        auth_headers_patient: dict,
        test_doctor: dict,
        test_patient: dict,
    ):
        """POST /api/v1/appointments → 201 with appointment details."""
        payload = {
            "doctor_id": test_doctor["id"],
            "patient_id": test_patient["id"],
            "scheduled_at": "2099-11-15T14:00:00Z",  # far future avoids real conflicts
            "notes": "Routine check-up",
        }
        resp = await client.post(
            "/api/v1/appointments",
            json=payload,
            headers=auth_headers_patient,
        )
        assert resp.status_code == 201, (
            f"Expected 201, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert "id" in data
        assert data["doctor_id"] == test_doctor["id"]

    @pytest.mark.asyncio
    async def test_appointment_conflict(
        self,
        client: AsyncClient,
        auth_headers_patient: dict,
        test_doctor: dict,
        test_patient: dict,
        existing_appointment: dict,
    ):
        """
        Attempt to book at the exact same slot as existing_appointment → 409.
        The service must protect against double-booking the same doctor slot.
        """
        conflicting_payload = {
            "doctor_id": test_doctor["id"],
            "patient_id": test_patient["id"],
            "scheduled_at": "2099-12-31T10:00:00Z",  # matches existing_appointment
            "notes": "This should conflict",
        }
        resp = await client.post(
            "/api/v1/appointments",
            json=conflicting_payload,
            headers=auth_headers_patient,
        )
        assert resp.status_code == 409, (
            f"Double-booking should return 409, got {resp.status_code}: {resp.text}"
        )

    @pytest.mark.asyncio
    async def test_cancel_appointment(
        self,
        client: AsyncClient,
        auth_headers_patient: dict,
        existing_appointment: dict,
    ):
        """PATCH /api/v1/appointments/{id}/cancel → 200 with status='cancelled'."""
        resp = await client.patch(
            f"/api/v1/appointments/{existing_appointment['id']}/cancel",
            headers=auth_headers_patient,
        )
        assert resp.status_code == 200, (
            f"Expected 200 on cancel, got {resp.status_code}: {resp.text}"
        )
        assert resp.json().get("status") == "cancelled"


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------

class TestBilling:
    @pytest.mark.asyncio
    async def test_create_billing_invoice(
        self,
        client: AsyncClient,
        auth_headers_hospital_admin: dict,
        test_patient: dict,
        test_hospital: dict,
    ):
        """POST /api/v1/billing → 201 with invoice id and amount."""
        payload = {
            "patient_id": test_patient["id"],
            "hospital_id": test_hospital["id"],
            "line_items": [
                {"description": "Consultation fee", "amount": 500.00},
                {"description": "Lab test — CBC", "amount": 250.00},
            ],
            "currency": "INR",
        }
        resp = await client.post(
            "/api/v1/billing",
            json=payload,
            headers=auth_headers_hospital_admin,
        )
        assert resp.status_code == 201, (
            f"Expected 201, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert "id" in data, "Invoice must have an id"
        assert data.get("total_amount") == 750.00 or data.get("status") == "pending"

    @pytest.mark.asyncio
    async def test_patient_cannot_create_invoice(
        self,
        client: AsyncClient,
        auth_headers_patient: dict,
        test_patient: dict,
        test_hospital: dict,
    ):
        """Patients must not be able to create billing invoices → 403."""
        payload = {
            "patient_id": test_patient["id"],
            "hospital_id": test_hospital["id"],
            "line_items": [{"description": "Fake charge", "amount": 0.01}],
            "currency": "INR",
        }
        resp = await client.post(
            "/api/v1/billing",
            json=payload,
            headers=auth_headers_patient,
        )
        assert resp.status_code == 403, (
            f"Patient role should not create invoices, got {resp.status_code}"
        )
