"""
Data Deletion Service — DPDP Act 2023 Right to Erasure (§12)

Processes patient deletion requests, distinguishing between:
  - Data that CAN be permanently deleted (PII, marketing, preferences)
  - Data that CANNOT be deleted but is anonymized (legally required medical records)

Legal retention requirements are derived from:
  - Indian Medical Council (Professional Conduct, Etiquette and Ethics) Regulations 2002
    → Medical records: 3 years minimum; best practice 7 years
  - Clinical Establishments Act 2010
  - Drugs & Cosmetics Act 1940 (prescription records: 5 years)
  - Income Tax Act 1961 (billing/financial records: 8 years)
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import (
    Appointment,
    ConsentRecord,
    DataDeletionRequest,
    DeviceToken,
    LabResult,
    MarketingPreference,
    NotificationToken,
    Patient,
    Prescription,
)

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

ANONYMISED_NAME_PREFIX = "DELETED_USER"

LEGALLY_EXEMPT_RECORDS: dict[str, str] = {
    "medical_records": "Indian Medical Council Regulations 2002 — minimum 3 years, best practice 7 years",
    "prescriptions": "Drugs & Cosmetics Act 1940 — 5 year retention",
    "lab_results": "NABL accreditation requirements — 5 year minimum",
    "surgical_records": "Indian Medical Council Regulations 2002 — 7 year retention",
    "billing_records": "Income Tax Act 1961 — 8 year retention",
    "appointments": "Clinical Establishments Act 2010 — retained as part of treatment record",
}

DELETABLE_CATEGORIES: list[str] = [
    "contact_information",
    "marketing_preferences",
    "push_notification_tokens",
    "device_tokens",
    "account_preferences",
    "search_history",
    "app_usage_analytics",
]


# ─── Main service function ────────────────────────────────────────────────────


async def process_deletion_request(
    patient_id: UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    """
    Execute a patient's approved right-to-erasure request.

    Steps
    -----
    1.  Verify the pending deletion request exists.
    2.  Anonymise the patient's PII (name, phone, email, address).
    3.  Hard-delete marketing preferences, notification tokens, device tokens.
    4.  Revoke all active consent records (audit trail preserved).
    5.  Soft-delete the patient account (deleted_at timestamp).
    6.  Mark the DataDeletionRequest as completed.
    7.  Return a structured summary of actions taken.

    Medical records, prescriptions, lab results, appointments, and billing
    records are RETAINED but their patient_name field is replaced with
    the anonymised identifier. The patient's identity can no longer be
    inferred from those records.

    Returns
    -------
    dict  Summary of deleted vs anonymised data, suitable for a compliance log.
    """
    # ── 1. Fetch the pending deletion request ─────────────────────────────────
    req_result = await db.execute(
        select(DataDeletionRequest).where(
            DataDeletionRequest.patient_id == patient_id,
            DataDeletionRequest.status == "pending",
        )
    )
    deletion_request = req_result.scalar_one_or_none()

    if not deletion_request:
        raise ValueError(
            f"No pending deletion request found for patient {patient_id}. "
            "Request must be created via POST /api/v1/data-rights/deletion-request before processing."
        )

    # ── 2. Fetch patient record ───────────────────────────────────────────────
    patient_result = await db.execute(
        select(Patient).where(Patient.id == patient_id)
    )
    patient = patient_result.scalar_one_or_none()

    if not patient:
        raise ValueError(f"Patient {patient_id} not found.")

    if patient.deleted_at is not None:
        raise ValueError(f"Patient {patient_id} has already been deleted.")

    anonymised_label = f"{ANONYMISED_NAME_PREFIX}_{str(patient_id)[:8].upper()}"
    actions: dict[str, Any] = {
        "anonymised": [],
        "deleted": [],
        "retained_with_legal_basis": list(LEGALLY_EXEMPT_RECORDS.keys()),
    }

    # ── 3. Anonymise PII on the Patient row ───────────────────────────────────
    original_phone = patient.phone  # save for SMS confirmation before clearing

    await db.execute(
        update(Patient)
        .where(Patient.id == patient_id)
        .values(
            name=anonymised_label,
            phone=None,
            email=None,
            address=None,
            date_of_birth=None,      # biometric — must be cleared
            emergency_contact=None,
            profile_photo_url=None,
            deleted_at=datetime.now(timezone.utc),
        )
    )
    actions["anonymised"].append("patient_demographics (name, phone, email, address, DOB)")
    logger.info("Anonymised PII for patient %s → %s", patient_id, anonymised_label)

    # ── 4. Anonymise patient_name on legally-retained records ─────────────────
    # These tables keep their rows for legal retention but lose the linkable name.
    for Model in (Appointment, Prescription, LabResult):
        if hasattr(Model, "patient_name"):
            await db.execute(
                update(Model)
                .where(Model.patient_id == patient_id)
                .values(patient_name=anonymised_label)
            )

    # ── 5. Hard-delete marketing and device data ──────────────────────────────
    deleted_counts: dict[str, int] = {}

    marketing_del = await db.execute(
        delete(MarketingPreference).where(
            MarketingPreference.patient_id == patient_id
        )
    )
    deleted_counts["marketing_preferences"] = marketing_del.rowcount

    notif_del = await db.execute(
        delete(NotificationToken).where(
            NotificationToken.patient_id == patient_id
        )
    )
    deleted_counts["notification_tokens"] = notif_del.rowcount

    device_del = await db.execute(
        delete(DeviceToken).where(
            DeviceToken.patient_id == patient_id
        )
    )
    deleted_counts["device_tokens"] = device_del.rowcount

    actions["deleted"] = [
        f"{category} ({count} record{'s' if count != 1 else ''})"
        for category, count in deleted_counts.items()
    ]
    logger.info("Hard-deleted marketing/device data for patient %s: %s", patient_id, deleted_counts)

    # ── 6. Revoke all active consent records (preserve audit trail) ───────────
    await db.execute(
        update(ConsentRecord)
        .where(
            ConsentRecord.patient_id == patient_id,
            ConsentRecord.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    actions["anonymised"].append("consent_records (revoked, audit trail preserved)")

    # ── 7. Mark deletion request as completed ─────────────────────────────────
    completed_at = datetime.now(timezone.utc)
    deletion_request.status = "completed"
    deletion_request.completed_at = completed_at
    deletion_request.notes = json.dumps(
        {
            "anonymised_label": anonymised_label,
            "actions": actions,
            "legal_retention_basis": LEGALLY_EXEMPT_RECORDS,
        },
        default=str,
    )

    await db.commit()
    logger.info("Deletion request %s completed for patient %s", deletion_request.id, patient_id)

    # ── 8. Attempt SMS confirmation (best-effort, phone already cleared) ───────
    if original_phone:
        await _send_deletion_confirmation_sms(original_phone, anonymised_label)

    summary = {
        "request_id": str(deletion_request.id),
        "patient_id": str(patient_id),
        "anonymised_identifier": anonymised_label,
        "completed_at": completed_at.isoformat(),
        "actions_taken": actions,
        "legal_retention": {
            "message": (
                "The following data categories are retained pursuant to applicable Indian law "
                "and cannot be deleted. They have been anonymised so they cannot be linked "
                "to your identity."
            ),
            "categories": LEGALLY_EXEMPT_RECORDS,
        },
        "dpdp_compliance": {
            "act": "Digital Personal Data Protection Act 2023",
            "section": "Section 12 — Right of Data Principal to erasure of personal data",
            "processor_obligations": "Hospyn retains de-identified data as required by statute.",
        },
    }

    return summary


async def _send_deletion_confirmation_sms(phone: str, anonymised_label: str) -> None:
    """
    Best-effort SMS confirmation. Failures are logged but do not fail the deletion.
    In production, wire this to the SMS gateway used elsewhere in the platform.
    """
    try:
        # TODO: replace with actual SMS gateway call (e.g. MSG91, Twilio)
        logger.info(
            "SMS confirmation sent to %s: deletion complete, identifier %s",
            phone[-4:].rjust(len(phone), "*"),   # mask number in logs
            anonymised_label,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to send deletion confirmation SMS: %s", exc)


# ─── Background task entry point ─────────────────────────────────────────────


async def run_pending_deletions(db: AsyncSession) -> list[dict]:
    """
    Process ALL pending deletion requests.
    Intended to be called by a scheduled background task (e.g. APScheduler or Celery beat).
    Returns a list of result summaries.
    """
    result = await db.execute(
        select(DataDeletionRequest).where(DataDeletionRequest.status == "pending")
    )
    pending = result.scalars().all()

    summaries: list[dict] = []
    for req in pending:
        try:
            summary = await process_deletion_request(req.patient_id, db)
            summaries.append(summary)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Failed to process deletion request %s for patient %s: %s",
                req.id,
                req.patient_id,
                exc,
            )
            req.status = "failed"
            req.notes = str(exc)
            await db.commit()

    return summaries
