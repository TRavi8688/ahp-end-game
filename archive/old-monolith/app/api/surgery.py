from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from app.core.database import get_db
from app.api import deps
from app.schemas.surgery import SurgeryCreate, SurgeryRead, SurgeryUpdate
from app.services.surgery_service import SurgeryService

router = APIRouter()

@router.post("/", response_model=SurgeryRead)
async def schedule_surgery(
    obj_in: SurgeryCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_hospital_admin)
):
    """
    OT BOOKING:
    Schedules a new surgery after verifying theatre and surgeon availability.
    """
    try:
        surgery = await SurgeryService.schedule_surgery(
            db=db,
            hospital_id=user.staff_profile.hospital_id,
            patient_id=obj_in.patient_id,
            theatre_id=obj_in.theatre_id,
            surgeon_id=obj_in.lead_surgeon_id,
            procedure_name=obj_in.procedure_name,
            scheduled_start=obj_in.scheduled_start,
            scheduled_end=obj_in.scheduled_end
        )
        return surgery
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{surgery_id}", response_model=SurgeryRead)
async def update_surgery(
    surgery_id: uuid.UUID,
    obj_in: SurgeryUpdate,
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_hospital_admin)
):
    """
    SURGICAL PROGRESS:
    Updates status (e.g., IN_PROGRESS, COMPLETED) or add post-op notes.
    """
    try:
        surgery = await SurgeryService.update_status(
            db=db,
            surgery_id=surgery_id,
            status=obj_in.status,
            notes=obj_in.notes
        )
        return surgery
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/schedule", response_model=List[SurgeryRead])
async def get_schedule(
    db: AsyncSession = Depends(get_db),
    user = Depends(deps.get_current_hospital_admin)
):
    """
    OT CALENDAR:
    View all scheduled surgeries in the hospital.
    """
    surgeries = await SurgeryService.get_hospital_schedule(
        db=db,
        hospital_id=user.staff_profile.hospital_id
    )
    return surgeries
