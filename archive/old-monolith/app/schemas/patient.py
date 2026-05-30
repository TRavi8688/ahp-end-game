from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    phone_number: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None

class PatientRead(BaseModel):
    id: UUID
    user_id: UUID
    hospyn_id: str
    first_name: str
    last_name: str
    phone_number: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
