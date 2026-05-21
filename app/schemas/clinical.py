from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Union
import uuid
from datetime import datetime
from enum import Enum

class PrescriptionStatusEnum(str, Enum):
    pending = "pending"
    fulfilled = "fulfilled"
    cancelled = "cancelled"
    expired = "expired"

class MedicationOrder(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None

class PrescriptionBase(BaseModel):
    patient_id: Union[uuid.UUID, str]  # Accepts UUID object from DB, or UUID/Hospyn ID string from frontend
    visit_id: Optional[Union[uuid.UUID, str]] = None
    diagnosis: Optional[str] = None
    medications: List[MedicationOrder]
    notes: Optional[str] = None

class PrescriptionCreate(PrescriptionBase):
    pass

class PrescriptionResponse(PrescriptionBase):
    id: uuid.UUID
    doctor_id: uuid.UUID
    hospital_id: uuid.UUID
    status: PrescriptionStatusEnum
    created_at: datetime
    signature_hash: Optional[str] = None # FORENSIC SEAL
    
    model_config = ConfigDict(from_attributes=True)
