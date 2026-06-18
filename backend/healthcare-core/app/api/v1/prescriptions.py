"""
Prescriptions API — Healthcare Core
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.prescription import Prescription

router = APIRouter()


@router.get("/prescriptions/patient/{patient_id}", summary="Get prescriptions for a patient")
async def get_patient_prescriptions(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Prescription).where(Prescription.patient_id == patient_id)
    )
    return result.scalars().all()
