"""
DPDP Consent Management API
Handles patient consent for data processing — required under DPDP Act 2023 (India).

Legal basis: Section 6 (Consent), Section 12 (Deemed Consent), Section 13 (Right to withdraw consent),
             Section 11 (Right of Data Principal to access information).
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models import (
    Appointment,
    ConsentRecord,
    DataDeletionRequest,
    LabResult,
    Patient,
    Prescription,
)

router = APIRouter(prefix="/api/v1", tags=["DPDP Compliance"])

ConsentType = Literal["data_processing", "marketing", "research", "telemedicine"]

CONSENT_VERSION_CURRENT = "1.0"

# ─── Schemas ──────────────────────────────────────────────────────────────────


class ConsentGrantRequest(BaseModel):
    patient_id: UUID
    hospital_id: UUID
    consent_type: ConsentType
    version: str = Field(default=CONSENT_VERSION_CURRENT)


class ConsentRevokeRequest(BaseModel):
    patient_id: UUID
    consent_type: ConsentType


class ConsentStatusResponse(BaseModel):
    patient_id: UUID
    data_processing: bool
    marketing: bool
    research: bool
    telemedicine: bool
    last_updated: Optional[datetime]


class ConsentHistoryItem(BaseModel):
    id: UUID
    consent_type: ConsentType
    granted: bool
    version: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime
    revoked_at: Optional[datetime]


class DeletionRequestResponse(BaseModel):
    request_id: UUID
    status: str
    message: str
    exempt_records: list[str]
    submitted_at: datetime


class MyDataResponse(BaseModel):
    patient_id: UUID
    exported_at: datetime
    demographics: dict
    appointments: list[dict]
    prescriptions: list[dict]
    lab_results: list[dict]


# ─── Helpers ──────────────────────────────────────────────────────────────────


async def _assert_patient_owns_or_admin(
    patient_id: UUID,
    current_user,
    db: AsyncSession,
) -> None:
    """Raise 403 if the caller is neither the patient nor a hospital admin."""
    if current_user.role == "patient" and current_user.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own consent records.",
        )
    if current_user.role not in ("patient", "hospital_admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role.",
        )


async def _get_active_consent(
    patient_id: UUID,
    consent_type: ConsentType,
    db: AsyncSession,
) -> Optional[ConsentRecord]:
    result = await db.execute(
        select(ConsentRecord)
        .where(
            ConsentRecord.patient_id == patient_id,
            ConsentRecord.consent_type == consent_type,
            ConsentRecord.revoked_at.is_(None),
        )
        .order_by(ConsentRecord.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.post(
    "/consent/grant",
    status_code=status.HTTP_201_CREATED,
    summary="Grant consent for a specific purpose (DPDP §6)",
)
async def grant_consent(
    body: ConsentGrantRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Patient explicitly grants consent for a processing purpose.
    Records IP address and user-agent for audit purposes.
    Idempotent: granting consent already held is a no-op (returns existing record).
    """
    await _assert_patient_owns_or_admin(body.patient_id, current_user, db)

    # Idempotency: check for existing active consent
    existing = await _get_active_consent(body.patient_id, body.consent_type, db)
    if existing:
        return {
            "id": existing.id,
            "status": "already_granted",
            "consent_type": existing.consent_type,
            "granted_at": existing.created_at,
        }

    ip_address: str = request.headers.get("X-Forwarded-For", request.client.host)
    user_agent: str = request.headers.get("User-Agent", "")

    record = ConsentRecord(
        id=uuid.uuid4(),
        patient_id=body.patient_id,
        hospital_id=body.hospital_id,
        consent_type=body.consent_type,
        granted=True,
        version=body.version,
        ip_address=ip_address[:45],          # IPv6 max length
        user_agent=user_agent[:512],
        created_at=datetime.now(timezone.utc),
        revoked_at=None,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "id": record.id,
        "status": "granted",
        "consent_type": record.consent_type,
        "granted_at": record.created_at,
    }


@router.post(
    "/consent/revoke",
    status_code=status.HTTP_200_OK,
    summary="Revoke previously granted consent (DPDP §13)",
)
async def revoke_consent(
    body: ConsentRevokeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Patient revokes consent for a specific purpose.
    Revoking data_processing consent will restrict future clinical data access
    but does not trigger deletion (use /data-rights/deletion-request for that).
    """
    # Patients can only revoke their own consent
    if current_user.role == "patient" and current_user.patient_id != body.patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only revoke your own consent.",
        )

    active = await _get_active_consent(body.patient_id, body.consent_type, db)
    if not active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active {body.consent_type} consent found for this patient.",
        )

    active.revoked_at = datetime.now(timezone.utc)
    await db.commit()

    warning = None
    if body.consent_type == "data_processing":
        warning = (
            "You have revoked data processing consent. "
            "Clinical services may be unavailable until consent is re-granted. "
            "Existing medical records are retained as required by Indian Medical Council regulations."
        )

    return {
        "status": "revoked",
        "consent_type": body.consent_type,
        "revoked_at": active.revoked_at,
        "warning": warning,
    }


@router.get(
    "/consent/status/{patient_id}",
    response_model=ConsentStatusResponse,
    summary="Get patient's current consent status (DPDP §11)",
)
async def get_consent_status(
    patient_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_patient_owns_or_admin(patient_id, current_user, db)

    all_types: list[ConsentType] = ["data_processing", "marketing", "research", "telemedicine"]
    status_map: dict[str, bool] = {}
    last_updated: Optional[datetime] = None

    for ct in all_types:
        record = await _get_active_consent(patient_id, ct, db)
        status_map[ct] = record is not None
        if record and (last_updated is None or record.created_at > last_updated):
            last_updated = record.created_at

    return ConsentStatusResponse(
        patient_id=patient_id,
        last_updated=last_updated,
        **status_map,
    )


@router.get(
    "/consent/history/{patient_id}",
    response_model=list[ConsentHistoryItem],
    summary="Full audit trail of consent actions (DPDP §11)",
)
async def get_consent_history(
    patient_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns complete consent history including revoked records, ordered newest first."""
    await _assert_patient_owns_or_admin(patient_id, current_user, db)

    result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.patient_id == patient_id)
        .order_by(ConsentRecord.created_at.desc())
    )
    records = result.scalars().all()
    return [
        ConsentHistoryItem(
            id=r.id,
            consent_type=r.consent_type,
            granted=r.granted,
            version=r.version,
            ip_address=r.ip_address,
            user_agent=r.user_agent,
            created_at=r.created_at,
            revoked_at=r.revoked_at,
        )
        for r in records
    ]


# ─── Right to Erasure ─────────────────────────────────────────────────────────

LEGALLY_EXEMPT_RECORDS = [
    "Medical records (Indian Medical Council Act — 7 year retention)",
    "Prescription history (Drugs & Cosmetics Act — 5 year retention)",
    "Laboratory results (NABL accreditation requirements — 5 year retention)",
    "Surgical records (Indian Medical Council Act — 7 year retention)",
    "Billing records (Income Tax Act — 8 year retention)",
]


@router.post(
    "/data-rights/deletion-request",
    response_model=DeletionRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request deletion of personal data (DPDP §12 — Right to Erasure)",
)
async def request_data_deletion(
    current_user=Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    """
    Initiates a right-to-erasure request.

    Under DPDP Act 2023 and Indian Medical Council regulations, certain categories
    of medical data must be retained for statutory periods and cannot be deleted.
    These records will be anonymized rather than deleted. All other personal data
    (contact info, preferences, marketing data) will be permanently deleted within
    30 days.

    A background job (data_deletion_service) processes approved requests.
    """
    patient_id: UUID = current_user.patient_id

    # Check for existing pending request — prevent duplicates
    existing = await db.execute(
        select(DataDeletionRequest).where(
            DataDeletionRequest.patient_id == patient_id,
            DataDeletionRequest.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A deletion request is already pending for your account.",
        )

    req = DataDeletionRequest(
        id=uuid.uuid4(),
        patient_id=patient_id,
        status="pending",
        requested_at=datetime.now(timezone.utc),
        completed_at=None,
        notes=json.dumps({"exempt_records": LEGALLY_EXEMPT_RECORDS}),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    return DeletionRequestResponse(
        request_id=req.id,
        status="pending",
        message=(
            "Your deletion request has been received and will be processed within 30 days. "
            "Certain medical records are legally required to be retained; these will be "
            "anonymized. You will receive confirmation once processing is complete."
        ),
        exempt_records=LEGALLY_EXEMPT_RECORDS,
        submitted_at=req.requested_at,
    )


@router.get(
    "/data-rights/my-data/{patient_id}",
    response_model=MyDataResponse,
    summary="Download a copy of all personal data (DPDP §11 — Right to Access / Data Portability)",
)
async def download_my_data(
    patient_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a structured JSON export of all data held for the patient.
    Patients can only access their own data; hospital admins cannot use this endpoint.
    """
    if current_user.role != "patient" or current_user.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only export your own data.",
        )

    # Demographics
    patient_result = await db.execute(
        select(Patient).where(Patient.id == patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    demographics = {
        "id": str(patient.id),
        "name": patient.name,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "gender": patient.gender,
        "blood_group": patient.blood_group,
        "phone": patient.phone,
        "email": patient.email,
        "address": patient.address,
        "registered_at": patient.created_at.isoformat(),
    }

    # Appointments
    appts_result = await db.execute(
        select(Appointment).where(Appointment.patient_id == patient_id)
        .order_by(Appointment.scheduled_at.desc())
    )
    appointments = [
        {
            "id": str(a.id),
            "doctor_name": a.doctor_name,
            "department": a.department,
            "scheduled_at": a.scheduled_at.isoformat(),
            "status": a.status,
            "notes": a.notes,
        }
        for a in appts_result.scalars().all()
    ]

    # Prescriptions
    rx_result = await db.execute(
        select(Prescription).where(Prescription.patient_id == patient_id)
        .order_by(Prescription.prescribed_at.desc())
    )
    prescriptions = [
        {
            "id": str(p.id),
            "medication": p.medication_name,
            "dosage": p.dosage,
            "prescribed_by": p.doctor_name,
            "prescribed_at": p.prescribed_at.isoformat(),
        }
        for p in rx_result.scalars().all()
    ]

    # Lab results
    lab_result_rows = await db.execute(
        select(LabResult).where(LabResult.patient_id == patient_id)
        .order_by(LabResult.collected_at.desc())
    )
    lab_results = [
        {
            "id": str(lr.id),
            "test_name": lr.test_name,
            "result": lr.result_value,
            "unit": lr.unit,
            "reference_range": lr.reference_range,
            "collected_at": lr.collected_at.isoformat(),
        }
        for lr in lab_result_rows.scalars().all()
    ]

    return MyDataResponse(
        patient_id=patient_id,
        exported_at=datetime.now(timezone.utc),
        demographics=demographics,
        appointments=appointments,
        prescriptions=prescriptions,
        lab_results=lab_results,
    )


# ─── Legal documents ──────────────────────────────────────────────────────────


@router.get(
    "/legal/privacy-policy",
    summary="Current privacy policy metadata",
)
async def privacy_policy():
    return {
        "version": "1.0",
        "effective_date": "2024-01-01",
        "url": "https://hospyn.com/legal/privacy-policy",
        "summary": (
            "Hospyn processes your health data to provide medical services under "
            "the Digital Personal Data Protection Act 2023 (India). "
            "You may withdraw consent at any time."
        ),
    }


@router.get(
    "/legal/terms",
    summary="Current terms of service metadata",
)
async def terms_of_service():
    return {
        "version": "1.0",
        "effective_date": "2024-01-01",
        "url": "https://hospyn.com/legal/terms",
    }
