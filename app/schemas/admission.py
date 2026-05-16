from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from app.models.models import BedStatusEnum, AdmissionStatus

class BedBase(BaseModel):
    bed_number: str
    department_id: Optional[UUID] = None
    status: BedStatusEnum = BedStatusEnum.available

class BedCreate(BedBase):
    pass

class BedRead(BedBase):
    id: UUID
    
    class Config:
        from_attributes = True

class AdmissionCreate(BaseModel):
    patient_id: UUID
    bed_id: UUID
    queue_token_id: Optional[UUID] = None

class AdmissionRead(BaseModel):
    id: UUID
    patient_id: UUID
    bed_id: Optional[UUID]
    status: AdmissionStatus
    admitted_at: datetime
    discharged_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class WardStatusResponse(BaseModel):
    total_beds: int
    available_beds: int
    occupied_beds: int
    beds: List[BedRead]
