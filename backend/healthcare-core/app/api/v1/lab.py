"""
Lab API Routes (Staff Portal -- Lab Technician)

FIXED: LabDashboard.tsx (staff-portal) called /lab/orders, /lab/orders/{id}/results,
and /lab/upload-report, but no router in the backend ever served `/lab/*` -- only
an unrelated `/lab_results/` placeholder existed (see lab_results.py). The
LabOrder/LabOrderItem/LabTest models already existed (app/models/lab.py) with no
API layer on top of them. This file is that API layer.

Endpoints:
    GET  /lab/orders               - List lab orders for this hospital, filterable by status
    POST /lab/orders               - Create a new lab order for a patient
    POST /lab/orders/{id}/results  - Record sample collection, or finalize results
    POST /lab/upload-report        - Upload a report file (PDF/image), returns file_url
"""

import os
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.staff import StaffRole
from app.models.lab import LabOrder, LabOrderItem, LabTest, LabOrderStatus, LabResultStatus
from app.models.patient import Patient
from app.services.queue_service import resolve_staff, resolve_any_staff
from shared.utils.responses import success_response
from shared.audit import log_audit_event
from shared.security.files import validate_file_security
from shared.gcs import GCSStorageService

router = APIRouter()

LabStaff = Annotated[TokenPayload, Depends(require_role("lab", "admin", "hospital_admin"))]

# Frontend (LabDashboard.tsx) uses lowercase, simplified status keys.
# Map both directions against the DB's LabOrderStatus enum.
_STATUS_TO_FRONTEND = {
    LabOrderStatus.ORDERED: "pending",
    LabOrderStatus.SAMPLE_COLLECTED: "sample_collected",
    LabOrderStatus.IN_PROGRESS: "processing",
    LabOrderStatus.COMPLETED: "completed",
    LabOrderStatus.CANCELLED: "cancelled",
}
_STATUS_FROM_FRONTEND = {v: k for k, v in _STATUS_TO_FRONTEND.items()}


async def _resolve_lab_staff(db: AsyncSession, user_id: str):
    """Resolve staff. Accepts lab_technician, or any admin/owner staff profile."""
    staff = await resolve_staff(db, user_id, StaffRole.lab_technician)
    if not staff:
        staff = await resolve_any_staff(db, user_id)
    if not staff:
        raise HTTPException(
            status_code=403,
            detail="Staff profile not found. You must be registered as hospital staff.",
        )
    return staff


async def _get_or_create_test(db: AsyncSession, name: str) -> LabTest:
    """Lab tests are created on-the-fly by name -- there's no curated test
    catalog UI yet, so this just dedupes by name within a hospital-agnostic
    shared catalog (matches the comment already in app/models/lab.py)."""
    name = name.strip()
    result = await db.execute(select(LabTest).where(LabTest.name == name))
    test = result.scalars().first()
    if test:
        return test
    test = LabTest(
        name=name,
        code=name.upper().replace(" ", "_")[:20] or str(uuid.uuid4())[:8],
        price=0,
        turnaround_hours=24,
    )
    db.add(test)
    await db.flush()
    return test


def _serialize_order(order: LabOrder) -> dict:
    return {
        "id": str(order.id),
        "patient_id": str(order.patient_id),
        "patient_name": order.patient.full_name if order.patient else None,
        "doctor_name": order.doctor.full_name if order.doctor else None,
        "status": _STATUS_TO_FRONTEND.get(order.status, "pending"),
        "tests": [
            {"name": item.test.name if item.test else "Unknown Test"} for item in order.items
        ],
        "created_at": order.ordered_at.isoformat() if order.ordered_at else None,
    }


# ---------------------------------------------------------------------------
# GET /lab/orders
# ---------------------------------------------------------------------------


@router.get("/orders")
async def list_lab_orders(
    current_user: LabStaff,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    staff = await _resolve_lab_staff(db, current_user.sub)

    query = (
        select(LabOrder)
        .where(LabOrder.hospital_id == staff.hospital_id)
        .options(
            selectinload(LabOrder.patient),
            selectinload(LabOrder.doctor),
            selectinload(LabOrder.items).selectinload(LabOrderItem.test),
        )
        .order_by(LabOrder.ordered_at.desc())
    )
    if status and status in _STATUS_FROM_FRONTEND:
        query = query.where(LabOrder.status == _STATUS_FROM_FRONTEND[status])

    result = await db.execute(query)
    orders = result.scalars().all()

    return success_response(data=[_serialize_order(o) for o in orders])


# ---------------------------------------------------------------------------
# POST /lab/orders
# ---------------------------------------------------------------------------


class CreateLabOrderPayload(BaseModel):
    patient_id: str
    test_names: list[str] = Field(..., min_length=1)


@router.post("/orders", status_code=201)
async def create_lab_order(
    payload: CreateLabOrderPayload,
    current_user: LabStaff,
    db: AsyncSession = Depends(get_db),
):
    staff = await _resolve_lab_staff(db, current_user.sub)

    try:
        patient_uuid = uuid.UUID(payload.patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patient_id")

    patient_result = await db.execute(
        select(Patient).where(Patient.id == patient_uuid, Patient.deleted_at.is_(None))
    )
    patient = patient_result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    order = LabOrder(
        patient_id=patient.id,
        hospital_id=staff.hospital_id,
        status=LabOrderStatus.ORDERED,
    )
    db.add(order)
    await db.flush()

    for name in payload.test_names:
        if not name.strip():
            continue
        test = await _get_or_create_test(db, name)
        db.add(LabOrderItem(order_id=order.id, test_id=test.id, result_status=LabResultStatus.PENDING))

    await db.flush()

    log_audit_event(
        action="lab_order_created",
        actor_id=current_user.sub,
        target_id=str(order.id),
        details={"patient_id": str(patient.id), "tests": payload.test_names},
    )

    return success_response(data={"order_id": str(order.id)}, message="Lab order created", status_code=201)


# ---------------------------------------------------------------------------
# POST /lab/orders/{order_id}/results
# ---------------------------------------------------------------------------


class ResultRowPayload(BaseModel):
    test_name: str
    value: str
    unit: str = ""
    reference_range: str = ""
    is_abnormal: bool = False
    clinical_remarks: str = ""


class SubmitResultsPayload(BaseModel):
    results: list[ResultRowPayload]
    file_url: Optional[str] = None


@router.post("/orders/{order_id}/results")
async def submit_lab_results(
    order_id: uuid.UUID,
    payload: SubmitResultsPayload,
    current_user: LabStaff,
    db: AsyncSession = Depends(get_db),
):
    staff = await _resolve_lab_staff(db, current_user.sub)

    result = await db.execute(
        select(LabOrder)
        .where(LabOrder.id == order_id, LabOrder.hospital_id == staff.hospital_id)
        .options(selectinload(LabOrder.items).selectinload(LabOrderItem.test))
    )
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")
    if order.status == LabOrderStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Results already submitted for this order")

    # FIXED: LabDashboard.tsx uses this same endpoint for two distinct
    # actions -- "Mark Sample Collected" (sends one placeholder row, only
    # available while status is ORDERED) and "Enter Results" (sends real
    # structured rows, only available once status is SAMPLE_COLLECTED or
    # IN_PROGRESS). Distinguish by the order's current status rather than
    # by inspecting the payload, since the placeholder row has no special
    # marker the backend should rely on.
    if order.status == LabOrderStatus.ORDERED:
        order.status = LabOrderStatus.SAMPLE_COLLECTED
        await db.flush()
        log_audit_event(action="lab_sample_collected", actor_id=current_user.sub, target_id=str(order.id))
        return success_response(message="Sample marked as collected")

    by_name = {item.test.name.strip().lower(): item for item in order.items if item.test}
    for row in payload.results:
        item = by_name.get(row.test_name.strip().lower())
        if not item:
            test = await _get_or_create_test(db, row.test_name)
            item = LabOrderItem(order_id=order.id, test_id=test.id)
            db.add(item)
        item.result_value = row.value
        item.unit = row.unit or None
        item.reference_range = row.reference_range or None
        item.clinical_remarks = row.clinical_remarks or None
        item.result_status = LabResultStatus.ABNORMAL if row.is_abnormal else LabResultStatus.NORMAL
        item.resulted_by = uuid.UUID(current_user.sub)

    order.status = LabOrderStatus.COMPLETED
    if payload.file_url:
        order.file_url = payload.file_url
    await db.flush()

    log_audit_event(
        action="lab_results_finalized",
        actor_id=current_user.sub,
        target_id=str(order.id),
        details={"result_count": len(payload.results)},
    )

    return success_response(message="Results submitted and pushed to patient EHR")


# ---------------------------------------------------------------------------
# POST /lab/upload-report
# ---------------------------------------------------------------------------


@router.post("/upload-report")
async def upload_lab_report(
    current_user: LabStaff,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    staff = await _resolve_lab_staff(db, current_user.sub)

    contents = await file.read()
    allowed_types = ["image/jpeg", "image/png", "application/pdf", "image/webp"]
    max_size = 10 * 1024 * 1024  # 10MB
    detected_mime = validate_file_security(
        file_content=contents,
        filename=file.filename,
        max_size_bytes=max_size,
        allowed_types=allowed_types,
    )

    storage = GCSStorageService()
    safe_filename = f"{uuid.uuid4()}{os.path.splitext(file.filename)[1].lower()}"
    object_name = f"lab-reports/{staff.hospital_id}/{safe_filename}"

    file_url = await storage.upload_file_bytes(
        file_content=contents, object_name=object_name, content_type=detected_mime
    )

    return success_response(data={"file_url": file_url}, message="Report uploaded")
