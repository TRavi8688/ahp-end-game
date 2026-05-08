from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from app.models.models import PrescriptionStatusEnum, LabOrderStatusEnum

# --- Prescription Schemas ---

class PrescriptionBase(BaseModel):
    patient_id: int
    medications: List[Dict[str, Any]] = Field(..., description="List of medications with dosage and frequency")
    notes: Optional[str] = None

class PrescriptionCreate(PrescriptionBase):
    pass

class PrescriptionResponse(PrescriptionBase):
    id: int
    hospital_id: int
    doctor_id: int
    status: PrescriptionStatusEnum
    qr_code_id: str
    signature_hash: str
    created_at: datetime
    fulfilled_at: Optional[datetime] = None
    pharmacist_id: Optional[int] = None

    class Config:
        from_attributes = True

# --- Lab Order Schemas ---

class LabOrderBase(BaseModel):
    patient_id: int
    tests: List[str]
    clinical_history: Optional[str] = None

class LabOrderCreate(LabOrderBase):
    pass

class LabStatusUpdate(BaseModel):
    status: LabOrderStatusEnum

class LabOrderResponse(LabOrderBase):
    id: int
    hospital_id: int
    doctor_id: int
    status: LabOrderStatusEnum
    ai_risk_level: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
