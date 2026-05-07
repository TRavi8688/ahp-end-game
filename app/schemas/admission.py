from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.admission import BedStatus, AdmissionStatus

class BedRead(BaseModel):
    id: int
    department_id: Optional[int]
    bed_number: str
    status: BedStatus
    version_id: int

    class Config:
        orm_mode = True

class AdmissionCreate(BaseModel):
    patient_id: int
    queue_token_id: Optional[int] = None

class AdmissionRead(BaseModel):
    id: int
    patient_id: int
    queue_token_id: Optional[int]
    bed_id: Optional[int]
    status: AdmissionStatus
    admitted_at: datetime
    discharged_at: Optional[datetime]
    version_id: int

    class Config:
        orm_mode = True
