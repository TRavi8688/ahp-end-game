"""
Lab Results API — Healthcare Core
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.lab_result import LabResult

router = APIRouter()


@router.get("/lab-results/patient/{patient_id}", summary="Get lab results for a patient")
async def get_patient_lab_results(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LabResult).where(LabResult.patient_id == patient_id)
    )
    return result.scalars().all()
