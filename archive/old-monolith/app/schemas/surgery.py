from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from app.models.models import SurgeryStatus

class SurgeryBase(BaseModel):
    procedure_name: str
    scheduled_start: datetime
    scheduled_end: datetime
    notes: Optional[str] = None

class SurgeryCreate(SurgeryBase):
    patient_id: UUID
    theatre_id: UUID
    lead_surgeon_id: UUID

class SurgeryUpdate(BaseModel):
    status: Optional[SurgeryStatus] = None
    notes: Optional[str] = None

class SurgeryRead(SurgeryBase):
    id: UUID
    patient_id: UUID
    theatre_id: UUID
    lead_surgeon_id: UUID
    status: SurgeryStatus
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    
    class Config:
        from_attributes = True

class TheatreBase(BaseModel):
    name: str
    is_active: bool = True

class TheatreRead(TheatreBase):
    id: UUID
    
    class Config:
        from_attributes = True
