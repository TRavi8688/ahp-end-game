"""
healthcare-core/app/api/internal.py

Internal service-to-service endpoints.
Only accessible by other microservices using signed internal JWTs.

FIX: Wrong import `from backend.shared.utils.service_auth import ...`
     -> `from shared.utils.service_auth import ...`

PLACE AT: backend/healthcare-core/app/api/internal.py
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from shared.utils.service_auth import verify_internal_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal", tags=["Internal Service-to-Service"])


@router.get("/clinical-summary/{patient_id}")
async def get_patient_clinical_summary(
    patient_id: str,
    internal_token_payload: dict = Depends(verify_internal_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Internal endpoint: allows AI Service to fetch raw clinical data for a patient.
    Secured by short-lived service-to-service JWTs with `aud=healthcare-core` claim.
    NOT exposed via nginx -- only reachable within the Docker/Cloud Run network.
    """
    calling_service = internal_token_payload.get("iss", "unknown")
    allowed_services = {"ai-service", "notification-service"}

    if calling_service not in allowed_services:
        logger.warning(
            "internal_access_denied: service=%s patient_id=%s",
            calling_service, patient_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Service '{calling_service}' is not authorized for internal access",
        )

    logger.info(
        "internal_clinical_summary_requested: service=%s patient_id=%s",
        calling_service, patient_id,
    )

    # Fetch from DB -- replace with your actual model queries
    from sqlalchemy import text
    result = await db.execute(
        text("""
            SELECT
                p.id,
                p.full_name,
                p.date_of_birth,
                p.blood_group,
                p.allergies,
                p.chronic_conditions
            FROM patients p
            WHERE p.id = :patient_id
              AND p.deleted_at IS NULL
        """),
        {"patient_id": patient_id},
    )
    row = result.mappings().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {patient_id} not found",
        )

    return {
        "patient_id": patient_id,
        "clinical_summary": dict(row),
        "requested_by_service": calling_service,
        "status": "success",
    }


@router.get("/patient-consent/{patient_id}")
async def verify_patient_consent(
    patient_id: str,
    consent_type: str,
    internal_token_payload: dict = Depends(verify_internal_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Internal endpoint: verify that a patient has given consent for a specific operation.
    Called by ai-service before processing patient data.
    """
    from sqlalchemy import text
    result = await db.execute(
        text("""
            SELECT consented_at FROM patient_consents
            WHERE patient_id = :patient_id
              AND consent_type = :consent_type
              AND revoked_at IS NULL
            LIMIT 1
        """),
        {"patient_id": patient_id, "consent_type": consent_type},
    )
    row = result.fetchone()

    return {
        "patient_id": patient_id,
        "consent_type": consent_type,
        "has_consent": row is not None,
        "consented_at": row[0].isoformat() if row else None,
    }
